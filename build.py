import os
import subprocess
import sys

def build():
    print("Building and obfuscating captcha_api.js...")
    src = os.path.join("templates", "api", "captcha_api.js")
    dest = os.path.join("static", "captcha_api.min.js")
    
    # Ensure static directory exists
    os.makedirs("static", exist_ok=True)
    
    cmd = f"javascript-obfuscator {src} --output {dest} --compact true --control-flow-flattening true --dead-code-injection true --disable-console-output true --string-array true --string-array-encoding rc4 --string-array-threshold 0.75"
    
    try:
        subprocess.run(cmd, shell=True, check=True)
        print(f"Successfully built {dest}")
        print("You can now commit this file and push to Pterodactyl.")
    except Exception as e:
        print(f"Failed to build: {e}")
        sys.exit(1)

if __name__ == "__main__":
    build()
