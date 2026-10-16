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
        CacheControl='public, max-age=300, s-maxage=2592000, stale-while-revalidate=86400'
    )

    cdn_url = "https://cdn.argusgroup.co.uk/api/v1/official-content/captcha_api.min.js"
    print(f"[SUCCESS] Uploaded to CDN successfully!")
    print(f"CDN Script URL: {cdn_url}")
    print(f"HTML Integration Snippet:")
    print(f'  <script src="{cdn_url}" async defer></script>')

    # 1. Flush origin worker in-memory cache
    try:
        import urllib.request
        purge_req = urllib.request.Request(f"{cdn_url}?purge=1", headers={'User-Agent': 'Argus-Build/1.0'})
        with urllib.request.urlopen(purge_req, timeout=5) as r:
            print("[SUCCESS] Origin CDN in-memory cache flushed.")
    except Exception as err:
        print(f"[INFO] Origin cache flush signal sent: {err}")

    # 2. Purge Cloudflare Edge cache worldwide immediately upon deployment
    cf_zone = os.getenv("CLOUDFLARE_ZONE_ID")
    cf_token = os.getenv("CLOUDFLARE_API_TOKEN")
    if cf_zone and cf_token:
        try:
            import json
            purge_data = json.dumps({"files": [cdn_url]}).encode('utf-8')
            req = urllib.request.Request(
                f"https://api.cloudflare.com/client/v4/zones/{cf_zone}/purge_cache",
                data=purge_data,
                headers={
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {cf_token}'
                },
                method='POST'
            )
            with urllib.request.urlopen(req, timeout=5) as resp:
                print(f"[SUCCESS] Cloudflare edge cache purged globally for {cdn_url}")
        except Exception as err:
            print(f"[WARN] Cloudflare edge cache purge failed: {err}")
    return cdn_url

def build():
    print("Building and obfuscating captcha_api.js...")
    src = os.path.join("templates", "api", "captcha_api.js")
    dest = os.path.join("static", "captcha_api.min.js")
    
    # Ensure static directory exists
    os.makedirs("static", exist_ok=True)

    # 1. Randomize the Polymorphic VM Seed in templates/api/captcha_api.js
    import random
    new_seed = random.randint(1, 254)
    print(f"Generating polymorphic VM opcode permutation with seed: 0x{new_seed:02X}...")
    try:
        with open(src, "r", encoding="utf-8") as f:
            code = f.read()
        import re
        code = re.sub(r'const _VM_SEED = 0x[0-9a-fA-F]+;', f'const _VM_SEED = 0x{new_seed:02X};', code)
        with open(src, "w", encoding="utf-8") as f:
            f.write(code)
    except Exception as e:
        print(f"[WARN] Could not mutate _VM_SEED: {e}")
    
    # 2. Multi-Tier Anti-Reverse Engineering Obfuscation Pipeline
    # Disperses string lookup calls into chained arithmetic wrappers to defeat automated AST unpackers
    cmd = (
        f"npx javascript-obfuscator {src} --output {dest} "
        f"--compact true "
        f"--control-flow-flattening true --control-flow-flattening-threshold 1 "
        f"--dead-code-injection true --dead-code-injection-threshold 0.4 "
        f"--disable-console-output true "
        f"--string-array true --string-array-encoding rc4 --string-array-threshold 1 "
        f"--string-array-calls-transform true --string-array-calls-transform-threshold 1 "
        f"--string-array-wrappers-count 5 --string-array-wrappers-chained-calls true "
        f"--string-array-wrappers-type function "
        f"--string-array-index-shift true --string-array-indexes-type hexadecimal-numeric-string "
        f"--string-array-shuffle true "
        f"--split-strings true --split-strings-chunk-length 5 "
        f"--transform-object-keys true --numbers-to-expressions true "
        f"--identifier-names-generator hexadecimal "
        f"--self-defending true "
        f"--vm-obfuscation true --vm-dynamic-opcodes true --vm-self-defending true "
        f"--vm-opcode-shuffle true --vm-bytecode-encoding true --vm-indirect-dispatch true"
    )
    
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
