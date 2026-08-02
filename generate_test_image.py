import base64
import sys
import os

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

try:
    from routes.v1.captcha import generate_visual_challenge
    
    print("Generating visual challenge image...")
    text, img_b64 = generate_visual_challenge()
    
    output_filename = "test_challenge.png"
    with open(output_filename, "wb") as fh:
        fh.write(base64.b64decode(img_b64))
        
    print(f"Success! Generated captcha challenge for text '{text}'.")
    print(f"Saved image to: {os.path.abspath(output_filename)}")
except Exception as e:
    print(f"Error generating challenge image: {e}")
