"""Mikata API, including the existing Mikata /check contract."""
import base64
import binascii
import os
import threading
import time
from collections import OrderedDict
from flask import Flask, jsonify, request, g
from werkzeug.exceptions import HTTPException
from research import ResearchEngine
from access import PublicAccess, AccessDenied
from google.genai.errors import APIError
from google.auth.exceptions import DefaultCredentialsError, RefreshError
import httpx

STATUS = {'SUPPORTED': 'supported', 'CONTRADICTED': 'contradicted', 'MIXED': 'needs_context',
          'INSUFFICIENT_EVIDENCE': 'insufficient_evidence', 'NOT_FACT_CHECKABLE': 'insufficient_evidence'}


def create_app(engine_factory=ResearchEngine, access_policy=None):
    app = Flask(__name__)
    access = access_policy if access_policy is not None else PublicAccess()
    app.config['MAX_CONTENT_LENGTH'] = 6 * 1024 * 1024
    buckets, lock = OrderedDict(), threading.Lock()
    slots = threading.BoundedSemaphore(2)
    idle_engines = []

    def error(message, code, status):
        return jsonify(error=message, code=code), status

    @app.before_request
    def limits():
        g.request_started = time.monotonic()
        if request.method == 'OPTIONS':
            return '', 204
        if request.method != 'POST':
            return None
        if access.required:
            with lock:
                now = time.monotonic()
                start, count = app.config.get('AUTH_BUCKET', (now, 0))
                if now - start > 60:
                    start, count = now, 0
                if count >= 120:
                    return error('The service is busy. Try again later.', 'RATE_LIMITED', 429)
                app.config['AUTH_BUCKET'] = (start, count + 1)
        try:
            g.user_id = access.authenticate(request.headers.get('Authorization', ''))
        except AccessDenied as exc:
            return error(str(exc), exc.code, exc.status)
        except Exception:
            return error('Sign-in verification is temporarily unavailable.', 'AUTH_UNAVAILABLE', 503)
        now = time.monotonic()
        # Never trust caller-supplied X-Forwarded-For. IP is a coarse guard only.
        key = g.user_id or request.remote_addr or 'unknown'
        with lock:
            while buckets and now - next(iter(buckets.values()))[0] > 60:
                buckets.popitem(last=False)
            start, count = buckets.get(key, (now, 0))
            global_start, global_count = app.config.get('GLOBAL_BUCKET', (now, 0))
            if now - global_start > 60:
                global_start, global_count = now, 0
            if count >= 6 or global_count >= 12:
                response, status = error('Request limit reached. Try again later.', 'RATE_LIMITED', 429)
                response.headers['Retry-After'] = '60'
                return response, status
            if len(buckets) >= 10000:
                return error('Server is busy.', 'BUSY', 503)
            buckets[key] = (start, count + 1)
            app.config['GLOBAL_BUCKET'] = (global_start, global_count + 1)

    @app.after_request
    def headers(response):
        origin = request.headers.get('Origin', '')
        allowed = os.getenv('ALLOWED_ORIGINS', '').split(',')
        if origin and origin in allowed:
            response.headers['Access-Control-Allow-Origin'] = origin
            response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
            response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
            response.headers['Vary'] = 'Origin'
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['Cache-Control'] = 'no-store'
        return response

    @app.errorhandler(HTTPException)
    def http_error(exc):
        return error(exc.name, 'HTTP_ERROR', exc.code)

    @app.get('/')
    @app.get('/api/health')
    def health():
        return jsonify(name='Mikata', status='ok', auth_required=access.required, vertex_configured=bool(os.getenv('GOOGLE_CLOUD_PROJECT')))

    @app.post('/check')
    @app.post('/api/check')
    @app.post('/api/analyze-image')
    def check():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return error('Expected a JSON object.', 'INVALID_INPUT', 400)
        language = data.get('language', 'en')
        if language not in ('en', 'ja'):
            return error('language must be en or ja.', 'INVALID_INPUT', 400)
        text, image, mime = None, None, None
        if request.path.endswith('analyze-image'):
            mime = data.get('mime_type')
            encoded = data.get('image_base64')
            if mime not in ('image/png', 'image/jpeg', 'image/webp') or not isinstance(encoded, str):
                return error('Send image_base64 and a supported mime_type.', 'INVALID_INPUT', 400)
            try:
                image = base64.b64decode(encoded, validate=True)
            except (ValueError, binascii.Error):
                return error('Invalid base64 image.', 'INVALID_INPUT', 400)
            signatures = {'image/png': image.startswith(b'\x89PNG\r\n\x1a\n'),
                          'image/jpeg': image.startswith(b'\xff\xd8\xff'),
                          'image/webp': image[:4] == b'RIFF' and image[8:12] == b'WEBP'}
            if not signatures[mime] or not 16 <= len(image) <= 4 * 1024 * 1024:
                return error('Image signature or size is invalid (maximum 4 MiB).', 'INVALID_INPUT', 400)
        else:
            text = data.get('claim', data.get('text'))
            if not isinstance(text, str) or not 8 <= len(text.strip()) <= 2000:
                return error('Send claim or text with 8–2000 characters.', 'INVALID_INPUT', 400)
            text = text.strip()
            if not isinstance(data.get('source_title', ''), str) or len(data.get('source_title', '')) > 200:
                return error('source_title must be at most 200 characters.', 'INVALID_INPUT', 400)
        if not slots.acquire(blocking=False):
            return error('Server is busy.', 'BUSY', 503)
        try:
            quota = access.reserve(g.user_id)
        except AccessDenied as exc:
            slots.release()
            response, status = error(str(exc), exc.code, exc.status)
            if exc.retry_after:
                response.headers['Retry-After'] = str(exc.retry_after)
            return response, status
        except Exception:
            slots.release()
            return error('Usage verification is unavailable.', 'QUOTA_UNAVAILABLE', 503)
        started = g.request_started
        engine = None
        try:
            with lock:
                engine = idle_engines.pop() if idle_engines else None
            if engine is None:
                engine = engine_factory()
            claims = engine.extract(text=text, image=image, mime=mime, language=language)
            results = engine.check(claims, language=language)
            payload = dict(results=results, claims=claims, schema_version='1.0', language=language,
                           processing_ms=round((time.monotonic() - started) * 1000))
            if quota is not None:
                payload['quota'] = quota
            # Legacy fields deliberately remain neutral for multi-claim input.
            if len(results) == 1:
                r = results[0]
                payload.update(status=STATUS[r['assessment']], summary=r['evidence_summary'],
                               detail=r['explanation'], sources=[s for s in r['sources'] if s.get('discovery_method') != 'research_candidate'])
            else:
                payload.update(status='insufficient_evidence', summary='抽出された主張を個別に確認してください。' if language == 'ja' else 'Review each extracted claim separately.',
                               detail='複数の主張に対して、まとめた真偽の判定は行いません。' if language == 'ja' else 'No aggregate factual verdict is assigned.', sources=[])
            return jsonify(payload)
        except (DefaultCredentialsError, RefreshError):
            return error('The research service could not authenticate to Google. Please contact the service owner.' if access.required else 'Google Cloud credentials are missing or expired. Run gcloud auth application-default login, then restart the backend.', 'CLOUD_AUTH_ERROR', 503)
        except (httpx.TimeoutException, TimeoutError):
            app.logger.warning('Vertex research deadline exceeded')
            response, status = error('Google research took too long. Try a shorter factual sentence or try again shortly.', 'PROVIDER_UNAVAILABLE', 503)
            response.headers['Retry-After'] = '30'
            return response, status
        except APIError as exc:
            # Status-only logging avoids exposing prompts, tokens or provider response bodies.
            app.logger.warning('Vertex request failed: status=%s', exc.code)
            if exc.code == 429 or exc.code in (500, 502, 503, 504):
                code = 'PROVIDER_RATE_LIMITED' if exc.code == 429 else 'PROVIDER_UNAVAILABLE'
                message = ('Google is busy or this project has reached its current request limit. Try again shortly.'
                           if exc.code == 429 else 'Google research is temporarily unavailable. Try again shortly.')
                response, status = error(message, code, 503)
                response.headers['Retry-After'] = '30'
                return response, status
            if exc.code == 400:
                return error('Google rejected this research request. Try another short factual sentence; if it repeats, report error 400.', 'RESEARCH_REQUEST_REJECTED', 503)
            if exc.code == 404:
                return error('The research model is currently unavailable. Please contact the service owner.' if access.required else 'The configured Gemini model is unavailable. Check GEMINI_MODEL and your project access, then restart the backend.', 'MODEL_UNAVAILABLE', 503)
            if exc.code in (401, 403):
                return error('The research service could not access Google AI. Please contact the service owner.' if access.required else 'Google Cloud denied access. Check your credentials and Vertex AI permissions.', 'CLOUD_AUTH_ERROR', 503)
            return error('Google AI research is temporarily unavailable. Try again later.', 'RESEARCH_UNAVAILABLE', 503)
        except Exception as exc:
            app.logger.warning('Research failed: exception_type=%s', type(exc).__name__)
            return error('Live research is unavailable or timed out. Try again later.', 'RESEARCH_UNAVAILABLE', 503)
        finally:
            if engine is not None:
                with lock:
                    idle_engines.append(engine)
            slots.release()

    return app

app = create_app()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=int(os.getenv('PORT', '8080')), debug=False)
