import os
import subprocess
import sys
import boto3
from dotenv import load_dotenv

# Load environment variables
basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'), override=False)
# Fallback to CDN repo env if present
cdn_env_path = os.path.abspath(os.path.join(basedir, '..', 'argus-group-cdn', '.env'))
if os.path.exists(cdn_env_path):
    load_dotenv(cdn_env_path, override=False)
load_dotenv(override=False)

def upload_to_r2(local_file_path):
    access_key = os.getenv('R2_ACCESS_KEY_ID')
    secret_key = os.getenv('R2_SECRET_ACCESS_KEY')
    endpoint_url = os.getenv('R2_ENDPOINT_URL')
    bucket_name = os.getenv('R2_BUCKET_NAME', 'argus-group-cdn')
    
    if not (access_key and secret_key and endpoint_url and bucket_name):
        print("[WARN] Cloudflare R2 credentials not fully set in .env. Skipping CDN upload.")
        print("       Required: R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_ENDPOINT_URL, R2_BUCKET_NAME")
        return None

    r2_key = "Official Argus Group Content/captcha_api.min.js"
    print(f"Uploading {local_file_path} to Cloudflare R2 [{bucket_name}] at key: {r2_key}...")

    s3 = boto3.client(
        's3',
        endpoint_url=endpoint_url,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name='auto'
    )

    with open(local_file_path, 'rb') as f:
        file_bytes = f.read()

    s3.put_object(
        Bucket=bucket_name,
        Key=r2_key,
        Body=file_bytes,
        ContentType='application/javascript',
        CacheControl='public, max-age=60, s-maxage=300'
    )

    cdn_url = "https://cdn.argusgroup.co.uk/api/v1/official-content/captcha_api.min.js"
    print(f"[SUCCESS] Uploaded to CDN successfully!")
    print(f"CDN Script URL: {cdn_url}")
    print(f"HTML Integration Snippet:")
    print(f'  <script src="{cdn_url}" async defer></script>')
    return cdn_url

def build():
    print("Building and obfuscating captcha_api.js...")
    src = os.path.join("templates", "api", "captcha_api.js")
    dest = os.path.join("static", "captcha_api.min.js")
    
    # Ensure static directory exists
    os.makedirs("static", exist_ok=True)
    
    cmd = f"javascript-obfuscator {src} --output {dest} --compact true --control-flow-flattening true --dead-code-injection true --disable-console-output false --string-array true --string-array-encoding rc4 --string-array-threshold 0.75"
    
    try:
        subprocess.run(cmd, shell=True, check=True)
        file_size = os.path.getsize(dest)
        print(f"Successfully built {dest} ({file_size} bytes)")
    except Exception as e:
        print(f"Failed to build: {e}")
        sys.exit(1)

    # Upload to Cloudflare R2 Official Content
    try:
        upload_to_r2(dest)
    except Exception as e:
        print(f"[ERROR] Failed to upload to Cloudflare R2: {e}")
        sys.exit(1)

if __name__ == "__main__":
    build()
