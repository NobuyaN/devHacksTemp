"""Read Firebase email/password status; an explicit flag enables that provider.

Run only after the owner approves provisioning. OAuth tokens stay in memory.
"""
import argparse
import subprocess
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'backend'))
import requests

if __name__ == '__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--project',required=True)
    parser.add_argument('--enable-email-password',action='store_true')
    args=parser.parse_args()
    token=subprocess.run(['gcloud','auth','print-access-token'],capture_output=True,text=True,check=True).stdout.strip()
    url='https://identitytoolkit.googleapis.com/admin/v2/projects/'+args.project+'/config'
    headers={'Authorization':'Bearer '+token}
    if args.enable_email_password:
        response=requests.patch(url,params={'updateMask':'signIn.email'},headers=headers,
            json={'signIn':{'email':{'enabled':True,'passwordRequired':True}}},timeout=15)
    else:
        response=requests.get(url,headers=headers,timeout=15)
    if not response.ok:
        print('Firebase Auth configuration request failed with HTTP',response.status_code)
        sys.exit(1)
    config=response.json().get('signIn',{}).get('email',{})
    print('Email/password enabled:',config.get('enabled') is True and config.get('passwordRequired') is True)
