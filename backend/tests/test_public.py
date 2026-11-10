"""Controlled public-access fixtures; no Firebase accounts, emails or cloud writes."""
import importlib.util
import json
import os
import tempfile
import unittest
import zipfile
from pathlib import Path
from types import SimpleNamespace as NS
from unittest.mock import Mock, patch
from access import AccessDenied, PublicAccess
from main import create_app

ROOT = Path(__file__).resolve().parents[2]

class PublicAccessTests(unittest.TestCase):
    def policy(self):
        with patch.dict(os.environ, {'AUTH_MODE':'firebase','GOOGLE_CLOUD_PROJECT':'fixture-project'}, clear=True):
            policy = PublicAccess()
        self.addCleanup(policy._quota_pool.shutdown, wait=False)
        policy._firebase = Mock(return_value=object())
        return policy

    def test_beta_defaults_allow_one_hundred_user_and_shared_requests(self):
        policy = self.policy()
        self.assertEqual((policy.user_limit, policy.global_limit), (100, 100))

    def test_cloud_run_cannot_disable_authentication(self):
        with patch.dict(os.environ, {'K_SERVICE':'fixture','AUTH_MODE':'local'}, clear=True), self.assertRaises(RuntimeError): PublicAccess()

    def test_cloud_run_cannot_use_emulator_signature_bypass(self):
        with patch.dict(os.environ, {'K_SERVICE':'fixture','AUTH_MODE':'firebase','FIREBASE_AUTH_EMULATOR_HOST':'localhost:9099'}, clear=True), self.assertRaises(RuntimeError): PublicAccess()

    def test_missing_token_does_not_call_verifier(self):
        policy = self.policy()
        with patch('firebase_admin.auth.verify_id_token') as verify, self.assertRaises(AccessDenied) as failure:
            policy.authenticate('')
        self.assertEqual(failure.exception.code,'AUTH_REQUIRED')
        verify.assert_not_called()

    def test_verified_token_is_checked_with_revocation_enabled(self):
        policy = self.policy()
        with patch('firebase_admin.auth.verify_id_token', return_value={'uid':'fixture-user','email_verified':True}) as verify:
            self.assertEqual(policy.authenticate('Bearer fixture-token'), 'fixture-user')
        self.assertTrue(verify.call_args.kwargs['check_revoked'])

    def test_unverified_email_is_denied(self):
        policy = self.policy()
        with patch('firebase_admin.auth.verify_id_token',return_value={'uid':'fixture-user','email_verified':False}), self.assertRaises(AccessDenied) as failure:
            policy.authenticate('Bearer fixture-token')
        self.assertEqual(failure.exception.code,'EMAIL_NOT_VERIFIED')

    def test_invalid_token_has_no_provider_body_in_error(self):
        policy = self.policy()
        with patch('firebase_admin.auth.verify_id_token',side_effect=ValueError('private fixture response')), self.assertRaises(AccessDenied) as failure:
            policy.authenticate('Bearer fixture-token')
        self.assertEqual(failure.exception.code,'INVALID_SESSION')
        self.assertNotIn('private',str(failure.exception))

class FakeReference:
    def __init__(self, db, name): self.db,self.name = db,name
    def get(self, **kwargs):
        self.db.operations.append('read')
        return NS(to_dict=lambda:self.db.documents.get(self.name))
class FakeDatabase:
    def __init__(self): self.documents={}; self.operations=[]
    def collection(self, name): return self
    def document(self, name): return FakeReference(self,name)
    def transaction(self, **kwargs):
        def write(ref,data):
            self.operations.append('write'); self.documents[ref.name]=data
        return NS(set=write)

class QuotaTests(unittest.TestCase):
    def policy(self, db, user=1, total=2):
        with patch.dict(os.environ, {'AUTH_MODE':'firebase','GOOGLE_CLOUD_PROJECT':'fixture-project'},clear=True): p=PublicAccess()
        self.addCleanup(p._quota_pool.shutdown,wait=False)
        p._db=db; p.user_limit=user; p.global_limit=total
        return p

    def test_durable_user_and_global_reservations_are_separate_and_fail_closed(self):
        db=FakeDatabase()
        p=self.policy(db)
        # The real SDK supplies transaction atomicity; this fixture verifies read/write ordering and limits.
        with patch('google.cloud.firestore.transactional',side_effect=lambda fn:fn):
            result=p.reserve('fixture-user-a')
            self.assertEqual(result['remaining'],0)
            self.assertEqual(db.operations[:4],['read','read','write','write'])
            second_process=self.policy(db)
            with self.assertRaises(AccessDenied) as user_limit: second_process.reserve('fixture-user-a')
            self.assertEqual(user_limit.exception.code,'DAILY_QUOTA_EXCEEDED')
            second_process.reserve('fixture-user-b')
            with self.assertRaises(AccessDenied) as global_limit: p.reserve('fixture-user-c')
            self.assertEqual(global_limit.exception.code,'SERVICE_DAILY_QUOTA_EXCEEDED')
        self.assertFalse(any('fixture-user' in key for key in db.documents))
        self.assertTrue(all(set(d)=={'count','expires_at'} for d in db.documents.values()))

    def test_database_failure_blocks_research_reservation(self):
        p=self.policy(Mock())
        p._db.collection.side_effect=RuntimeError('private database response')
        with self.assertRaises(AccessDenied) as failure: p.reserve('fixture-user')
        self.assertEqual(failure.exception.code,'QUOTA_UNAVAILABLE')
        self.assertNotIn('private',str(failure.exception))

    def test_hundredth_user_reservation_succeeds_and_next_is_rejected(self):
        db=FakeDatabase(); p=self.policy(db,user=100,total=200)
        with patch('google.cloud.firestore.transactional',side_effect=lambda fn:fn):
            p.reserve('fixture-user')
            for name, document in db.documents.items():
                document['count']=99
            result=p.reserve('fixture-user')
            self.assertEqual((result['daily_limit'],result['remaining']),(100,0))
            with self.assertRaises(AccessDenied) as failure: p.reserve('fixture-user')
            self.assertEqual(failure.exception.code,'DAILY_QUOTA_EXCEEDED')
            self.assertTrue(all(d['count']==100 for d in db.documents.values()))

    def test_shared_hundred_request_limit_applies_across_accounts(self):
        db=FakeDatabase(); p=self.policy(db,user=100,total=100)
        with patch('google.cloud.firestore.transactional',side_effect=lambda fn:fn):
            p.reserve('fixture-user-a')
            for name, document in db.documents.items():
                if name.startswith('global_'): document['count']=99
            self.assertEqual(p.reserve('fixture-user-b')['remaining'],99)
            with self.assertRaises(AccessDenied) as failure: p.reserve('fixture-user-c')
            self.assertEqual(failure.exception.code,'SERVICE_DAILY_QUOTA_EXCEEDED')

class PublicAPITests(unittest.TestCase):
    def setUp(self):
        self.policy=Mock(required=True)
        self.policy.authenticate.return_value='fixture-user'
        self.policy.reserve.return_value={'daily_limit':5,'remaining':4,'resets_at':'fixture'}
        self.engine=Mock(); self.engine.extract.return_value=[]; self.engine.check.return_value=[]
        self.client=create_app(lambda:self.engine,access_policy=self.policy).test_client()

    def test_unauthenticated_users_never_trigger_quota_or_model(self):
        self.policy.authenticate.side_effect=AccessDenied('Sign in','AUTH_REQUIRED',401)
        for route in ('/check','/api/check','/api/analyze-image'):
            self.assertEqual(self.client.post(route,json={'claim':'Fixture claim'}).status_code,401)
        self.policy.reserve.assert_not_called(); self.engine.extract.assert_not_called()

    def test_daily_limit_blocks_model_and_releases_concurrency_slot(self):
        self.policy.reserve.side_effect=AccessDenied('Daily limit','DAILY_QUOTA_EXCEEDED',429,60)
        response=self.client.post('/api/check',json={'claim':'Fixture claim'})
        self.assertEqual(response.json['code'],'DAILY_QUOTA_EXCEEDED'); self.assertEqual(response.headers['Retry-After'],'60')
        self.engine.extract.assert_not_called()
        self.policy.reserve.side_effect=None
        self.assertEqual(self.client.post('/api/check',json={'claim':'Fixture claim'}).status_code,200)

    def test_customer_errors_do_not_ask_users_to_configure_cloud_credentials(self):
        from google.auth.exceptions import DefaultCredentialsError
        from google.genai.errors import ClientError
        for failure in (DefaultCredentialsError('fixture'), ClientError(404,{'error':{'message':'fixture'}}), ClientError(403,{'error':{'message':'fixture'}})):
            self.engine.extract.side_effect=failure
            response=self.client.post('/api/check',json={'claim':'Fixture claim'})
            self.assertEqual(response.status_code,503)
            self.assertIn('service owner',response.json['error'])
            self.assertNotIn('gcloud',response.json['error'])
            self.assertNotIn('GEMINI_MODEL',response.json['error'])

    def test_success_includes_quota_and_cors_allows_authorization(self):
        response=self.client.post('/api/check',json={'claim':'Fixture claim'},headers={'Authorization':'Bearer fixture-token'})
        self.policy.authenticate.assert_called_with('Bearer fixture-token')
        self.assertEqual(response.json['quota']['remaining'],4)
        with patch.dict(os.environ,{'ALLOWED_ORIGINS':'https://fixture.example'}):
            preflight=self.client.options('/api/check',headers={'Origin':'https://fixture.example'})
        self.assertIn('Authorization',preflight.headers['Access-Control-Allow-Headers'])

class PublicBuildTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        spec=importlib.util.spec_from_file_location('public_build',ROOT/'scripts/build_public.py')
        cls.module=importlib.util.module_from_spec(spec); spec.loader.exec_module(cls.module)

    def config(self): return dict(projectId='fixture-project',apiOrigin='https://fixture-project.web.app',firebaseApiKey='AIza'+'x'*35,supportEmail='support@example.test')

    def test_fresh_profile_package_has_pinned_service_auth_and_no_local_permission(self):
        with tempfile.TemporaryDirectory() as tmp:
            result=self.module.build(self.config(),Path(tmp)/'public')
            extension=Path(result['extension'])
            manifest=json.loads((extension/'manifest.json').read_text())
            self.assertNotIn('http://localhost/*',manifest['host_permissions'])
            self.assertNotIn('https://*.run.app/*',manifest['host_permissions'])
            self.assertIn('https://fixture-project.web.app/*',manifest['host_permissions'])
            self.assertIn('"authRequired": true',(extension/'config.js').read_text())
            self.assertEqual(manifest['content_scripts'][0]['js'],['config.js','content.js'])
            with zipfile.ZipFile(result['archive']) as archive:
                self.assertIn('manifest.json',archive.namelist())
                self.assertFalse(any('credentials' in n or n.startswith('.') for n in archive.namelist()))
            firebase=json.loads(Path(result['firebase_config']).read_text())
            self.assertEqual(firebase['firestore'][0]['database'],'sourcelens')
            for group in firebase['hosting']['headers']:
                if any(h['key']=='Content-Security-Policy' for h in group['headers']):
                    self.assertNotIn(group['source'],('**','/__/**','/__/auth/**'))

    def test_repeated_builds_produce_identical_archives(self):
        import hashlib
        with tempfile.TemporaryDirectory() as tmp:
            first=self.module.build(self.config(),Path(tmp)/'one')
            second=self.module.build(self.config(),Path(tmp)/'two')
            self.assertEqual(hashlib.sha256(Path(first['archive']).read_bytes()).digest(),hashlib.sha256(Path(second['archive']).read_bytes()).digest())

    def test_builder_rejects_source_overwrite_and_unconfigured_or_local_release(self):
        with self.assertRaises(ValueError): self.module.build(self.config(),ROOT/'extension'/'generated')
        for field,value in [('apiOrigin','http://localhost:8080'),('firebaseApiKey','replace-me')]:
            config=self.config(); config[field]=value
            with tempfile.TemporaryDirectory() as tmp, self.assertRaises(ValueError): self.module.build(config,Path(tmp)/'public')

if __name__=='__main__': unittest.main()
