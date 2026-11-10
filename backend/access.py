"""End-user Firebase authentication and durable, atomic research quotas.

Local development keeps its existing unauthenticated contract. Cloud Run fails closed
unless Firebase authentication and a durable quota store are configured.
"""
import hashlib
import os
import threading
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta, timezone


class AccessDenied(Exception):
    def __init__(self, message, code, status, retry_after=None):
        super().__init__(message)
        self.code, self.status, self.retry_after = code, status, retry_after


class PublicAccess:
    def __init__(self):
        if os.getenv('K_SERVICE') and (os.getenv('FIREBASE_AUTH_EMULATOR_HOST') or os.getenv('FIRESTORE_EMULATOR_HOST')):
            raise RuntimeError('Cloud Run must not use authentication or database emulators')
        self.required = os.getenv('AUTH_MODE', 'firebase' if os.getenv('K_SERVICE') else 'local') == 'firebase'
        if os.getenv('K_SERVICE') and not self.required:
            raise RuntimeError('Cloud Run requires AUTH_MODE=firebase; local auth mode is not deployable')
        if os.getenv('AUTH_MODE', 'local') not in ('local', 'firebase'):
            raise RuntimeError('AUTH_MODE must be local or firebase')
        self.project = os.getenv('GOOGLE_CLOUD_PROJECT')
        self.user_limit = int(os.getenv('DAILY_USER_LIMIT', '100'))
        self.global_limit = int(os.getenv('DAILY_GLOBAL_LIMIT', '100'))
        self.database = os.getenv('QUOTA_DATABASE', 'sourcelens')
        self.verified_email = os.getenv('REQUIRE_VERIFIED_EMAIL', 'true').lower() == 'true'
        if self.required and (not self.project or self.user_limit < 1 or self.global_limit < 1):
            raise RuntimeError('Public access requires a project and positive daily quotas')
        self._app = self._db = None
        self._lock = threading.Lock()
        self._quota_jobs = threading.BoundedSemaphore(2)
        self._quota_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="quota") if self.required else None

    def _firebase(self):
        import firebase_admin
        with self._lock:
            if self._app is None:
                try:
                    self._app = firebase_admin.get_app('sourcelens-' + self.project)
                except ValueError:
                    self._app = firebase_admin.initialize_app(options={'projectId': self.project, 'httpTimeout': 5}, name='sourcelens-' + self.project)
        return self._app

    def authenticate(self, authorization):
        if not self.required:
            return None
        if not authorization.startswith('Bearer ') or len(authorization) > 12000:
            raise AccessDenied('Sign in to SourceLens to check a claim.', 'AUTH_REQUIRED', 401)
        from firebase_admin import auth
        try:
            claims = auth.verify_id_token(authorization[7:], app=self._firebase(), check_revoked=True)
        except (auth.ExpiredIdTokenError, auth.RevokedIdTokenError, auth.InvalidIdTokenError,
                auth.UserDisabledError, auth.UserNotFoundError, ValueError):
            raise AccessDenied('Your session is invalid or expired. Sign in again.', 'INVALID_SESSION', 401) from None
        except Exception:
            raise AccessDenied('Sign-in verification is temporarily unavailable.', 'AUTH_UNAVAILABLE', 503) from None
        if self.verified_email and claims.get('email_verified') is not True:
            raise AccessDenied('Verify your email, then refresh your sign-in session.', 'EMAIL_NOT_VERIFIED', 403)
        uid = claims.get('uid') or claims.get('sub')
        if not isinstance(uid, str) or not uid:
            raise AccessDenied('Your sign-in session is invalid.', 'INVALID_SESSION', 401)
        return uid

    def reserve(self, uid):
        if not self.required:
            return None
        if not self._quota_jobs.acquire(blocking=False):
            raise AccessDenied('Usage verification is busy. Try again later.', 'QUOTA_UNAVAILABLE', 503)
        future = self._quota_pool.submit(self._reserve, uid)
        future.add_done_callback(lambda _: self._quota_jobs.release())
        try:
            return future.result(timeout=6)
        except AccessDenied:
            raise
        except Exception:
            # A late transaction may still reserve quota, but no AI request starts after this failure.
            raise AccessDenied('Usage limits could not be checked. Please try again later.', 'QUOTA_UNAVAILABLE', 503) from None

    def _reserve(self, uid):
        from google.cloud import firestore
        with self._lock:
            if self._db is None:
                self._db = firestore.Client(project=self.project, database=self.database)
        now = datetime.now(timezone.utc)
        day = now.date().isoformat()
        reset = datetime.combine(now.date() + timedelta(days=1), datetime.min.time(), tzinfo=timezone.utc)
        collection = self._db.collection('_sourcelens_usage')
        global_ref = collection.document('global_' + day)
        user_ref = collection.document('user_' + day + '_' + hashlib.sha256(uid.encode()).hexdigest())
        try:
            @firestore.transactional
            def increment(transaction):
                # All reads precede writes; both reservations commit atomically.
                global_count = (global_ref.get(transaction=transaction, timeout=5, retry=None).to_dict() or {}).get('count', 0)
                user_count = (user_ref.get(transaction=transaction, timeout=5, retry=None).to_dict() or {}).get('count', 0)
                if global_count >= self.global_limit:
                    raise AccessDenied('The shared beta has reached its daily check limit. Try again after the daily reset.',
                                       'SERVICE_DAILY_QUOTA_EXCEEDED', 429, max(1, int((reset-now).total_seconds())))
                if user_count >= self.user_limit:
                    raise AccessDenied('You have reached your daily check allowance. Try again after the daily reset.',
                                       'DAILY_QUOTA_EXCEEDED', 429, max(1, int((reset-now).total_seconds())))
                expiration = now + timedelta(days=30)
                transaction.set(global_ref, {'count': global_count+1, 'expires_at': expiration})
                transaction.set(user_ref, {'count': user_count+1, 'expires_at': expiration})
                return dict(daily_limit=self.user_limit, remaining=self.user_limit-user_count-1, resets_at=reset.isoformat())
            return increment(self._db.transaction(max_attempts=2))
        except AccessDenied:
            raise
        except Exception:
            # No model request is made if the durable quota reservation fails.
            raise AccessDenied('Usage limits could not be checked. Please try again later.', 'QUOTA_UNAVAILABLE', 503) from None
