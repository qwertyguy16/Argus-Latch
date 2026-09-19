from flask import Blueprint, request, jsonify, render_template, make_response, url_for
from models import CaptchaApplication
from extensions import db, limiter
import secrets
import time
import math
from datetime import datetime
from functools import lru_cache

captcha_bp = Blueprint('captcha', __name__, url_prefix='/captcha')

TEST_KEYS = {
    'argus_1x000000000000000000000000': {'secret': 'sk_1x000000000000000000000000', 'type': 'pass'},
    'argus_2x000000000000000000000000': {'secret': 'sk_2x000000000000000000000000', 'type': 'fail'},
    'argus_3x000000000000000000000000': {'secret': 'sk_3x000000000000000000000000', 'type': 'auto'}
}

class MockTestApp:
    def __init__(self, site_key, secret_key, test_type):
        self.site_key = site_key
        self.secret_key = secret_key
        self.domains = ""
        self.mode = "manual"
        self.theme = "auto"
        self.block_vpns = False
        self.strict_mode = False
        self.under_attack_mode = False
        self.total_challenges = 0
        self.total_successes = 0
        self.total_failures = 0
        self.is_test = True
        self.test_type = test_type

def get_app_by_sitekey(site_key):
    if site_key in TEST_KEYS:
        data = TEST_KEYS[site_key]
        return MockTestApp(site_key, data['secret'], data['type'])
    return CaptchaApplication.query.filter_by(site_key=site_key).first()

def get_app_by_secret(secret_key):
    for sk, data in TEST_KEYS.items():
        if data['secret'] == secret_key:
            return MockTestApp(sk, secret_key, data['type'])
    return CaptchaApplication.query.filter_by(secret_key=secret_key).first()

def generate_visual_challenge():
    import io
    import base64
    import random
    import string
    import math
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    
    # Random text length between 5 and 6
    text = ''.join(random.choices(string.ascii_uppercase + string.digits, k=random.randint(5, 6)))
    # Increase dimensions for better visibility
    width, height = 280, 90
    img = Image.new('RGB', (width, height), color=(240, 240, 240))
    d = ImageDraw.Draw(img)
    
    # Try a list of standard/fallback fonts with size 44 for excellent readability
    font = None
    font_names = [
        "arial.ttf",
        "Arial.ttf",
        "DejaVuSans.ttf",
        "LiberationSans-Regular.ttf",
        "Roboto-Regular.ttf",
        "Helvetica.ttf",
        "Georgia.ttf",
        "C:\\Windows\\Fonts\\arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
    ]
    for font_name in font_names:
        try:
            font = ImageFont.truetype(font_name, 44)
            break
        except IOError:
            continue
            
    if font is None:
        try:
            font = ImageFont.load_default(size=44)
        except TypeError:
            font = ImageFont.load_default()
        
    # Draw background noise first
    for _ in range(500):
        d.point((random.randint(0, width), random.randint(0, height)), fill=(random.randint(100, 200), random.randint(100, 200), random.randint(100, 200)))
        
    # Add interference curves (sine waves)
    for _ in range(4):
        amplitude = random.randint(6, 18)
        frequency = random.uniform(0.015, 0.06)
        phase = random.uniform(0, math.pi * 2)
        y_offset = random.randint(25, height - 25)
        
        points = []
        for x in range(0, width, 2):
            y = y_offset + int(amplitude * math.sin(frequency * x + phase))
            points.append((x, y))
            
        color = (random.randint(100, 180), random.randint(100, 180), random.randint(100, 180))
        d.line(points, fill=color, width=random.randint(1, 3))
        
    # Draw text with rotation and scaling
    char_spacing = (width - 60) // len(text)
    for i, char in enumerate(text):
        char_img = Image.new('RGBA', (70, 70), (255, 255, 255, 0))
        char_draw = ImageDraw.Draw(char_img)
        char_color = (random.randint(0, 100), random.randint(0, 100), random.randint(0, 100), 255)
        
        char_draw.text((15, 10), char, fill=char_color, font=font)
        
        # Rotate and slightly scale
        angle = random.randint(-30, 30)
        char_img = char_img.rotate(angle, expand=0, resample=Image.BICUBIC)
        
        x = 15 + i * char_spacing + random.randint(-4, 4)
        y = 10 + random.randint(-6, 6)
        
        img.paste(char_img, (x, y), char_img)
    
    # Add foreground noise
    for _ in range(250):
        d.point((random.randint(0, width), random.randint(0, height)), fill=(random.randint(0, 150), random.randint(0, 150), random.randint(0, 150)))
        
    # Apply a slight blur
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    
    return text, img_b64

def generate_slider_challenge():
    import io
    import base64
    import random
    from PIL import Image, ImageDraw, ImageFilter

    width, height = 320, 150
    # Generate background
    bg_img = Image.new('RGB', (width, height), color=(random.randint(200, 255), random.randint(200, 255), random.randint(200, 255)))
    d = ImageDraw.Draw(bg_img)
    
    # Draw some random shapes
    for _ in range(20):
        shape_type = random.choice(['rectangle', 'ellipse'])
        x1 = random.randint(-50, width)
        y1 = random.randint(-50, height)
        x2 = x1 + random.randint(20, 100)
        y2 = y1 + random.randint(20, 100)
        color = (random.randint(100, 220), random.randint(100, 220), random.randint(100, 220))
        if shape_type == 'rectangle':
            d.rectangle([x1, y1, x2, y2], fill=color)
        else:
            d.ellipse([x1, y1, x2, y2], fill=color)
            
    # Add noise
    for _ in range(1000):
        d.point((random.randint(0, width), random.randint(0, height)), fill=(random.randint(50, 150), random.randint(50, 150), random.randint(50, 150)))
        
    bg_img = bg_img.filter(ImageFilter.GaussianBlur(0.5))

    piece_size = 40
    target_x = random.randint(50, width - piece_size - 10)
    target_y = random.randint(10, height - piece_size - 10)

    # Extract puzzle piece
    piece = bg_img.crop((target_x, target_y, target_x + piece_size, target_y + piece_size))
    
    # Create a mask for piece (a bit rounded)
    mask = Image.new('L', (piece_size, piece_size), 0)
    mask_draw = ImageDraw.Draw(mask)
    mask_draw.rounded_rectangle((0, 0, piece_size, piece_size), radius=5, fill=255)
    
    piece.putalpha(mask)
    
    # Add a border to the piece
    piece_draw = ImageDraw.Draw(piece)
    piece_draw.rounded_rectangle((0, 0, piece_size-1, piece_size-1), radius=5, outline=(255, 255, 255, 150), width=2)
    
    # Draw shadow on the background at target
    shadow = Image.new('RGBA', (piece_size, piece_size), (0, 0, 0, 120))
    shadow_mask = Image.new('L', (piece_size, piece_size), 0)
    ImageDraw.Draw(shadow_mask).rounded_rectangle((0, 0, piece_size, piece_size), radius=5, fill=255)
    shadow.putalpha(shadow_mask)
    bg_img.paste(shadow, (target_x, target_y), shadow)
    
    bg_buf = io.BytesIO()
    bg_img.save(bg_buf, format='PNG')
    bg_b64 = base64.b64encode(bg_buf.getvalue()).decode('utf-8')
    
    piece_buf = io.BytesIO()
    piece.save(piece_buf, format='PNG')
    piece_b64 = base64.b64encode(piece_buf.getvalue()).decode('utf-8')
    
    return bg_b64, piece_b64, target_x, target_y


import os
import subprocess
import hashlib
from flask import current_app

@captcha_bp.route('/api.js')
def api_js():
    """Serves the JavaScript for the Captcha widget."""
    min_path = os.path.join(current_app.root_path, 'static', 'captcha_api.min.js')
    
    if os.path.exists(min_path):
        with open(min_path, 'r', encoding='utf-8') as f:
            content = f.read()
    else:
        # Fallback for local development if build.py hasn't been run
        raw_path = os.path.join(current_app.root_path, 'templates', 'api', 'captcha_api.js')
        with open(raw_path, 'r', encoding='utf-8') as f:
            content = f.read()
            
    response = make_response(content)
    response.headers['Content-Type'] = 'application/javascript'
    response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    response.headers['Pragma'] = 'no-cache'
    return response

settings_cache = {}

@captcha_bp.route('/settings', methods=['GET', 'OPTIONS'])
@limiter.limit("60 per minute")
def get_settings():
    """Returns the captcha settings for a specific sitekey."""
    if request.method == 'OPTIONS':
        return '', 204
        
    site_key = request.args.get('sitekey')
    if not site_key:
        return jsonify({"success": False, "error": "Missing sitekey"}), 400
        
    # Check memory cache first (60s TTL)
    now = time.time()
    cache_entry = settings_cache.get(site_key)
    if cache_entry and now - cache_entry['timestamp'] < 60:
        app_theme = cache_entry['theme']
        app_mode = cache_entry['mode']
        app_domains = cache_entry['domains']
        app_is_test = cache_entry.get('is_test', False)
    else:
        # Hit the database
        app = get_app_by_sitekey(site_key)
        if not app:
            return jsonify({"success": False, "error": "Invalid sitekey"}), 400
            
        app_theme = app.theme or 'auto'
        app_mode = app.mode or 'manual'
        app_domains = app.domains
        app_is_test = getattr(app, 'is_test', False)
        
        # Save to cache
        settings_cache[site_key] = {
            'theme': app_theme,
            'mode': app_mode,
            'domains': app_domains,
            'is_test': app_is_test,
            'timestamp': now
        }
        
    if not is_domain_authorized(app_domains, request):
        return jsonify({"success": False, "error": "Domain not authorized"}), 403
        
    response = jsonify({
        "success": True,
        "theme": app_theme,
        "mode": app_mode,
        "is_test": app_is_test
    })
    # Tell the browser to cache this for 5 minutes (drastically speeds up repeat page loads)
    response.headers['Cache-Control'] = 'public, max-age=300'
    return response

def is_domain_authorized(app_domains, request):
    if not app_domains:
        return True
    allowed_domains = [d.strip() for d in app_domains.split(',') if d.strip()]
    if not allowed_domains:
        return True
    origin = request.headers.get('Origin')
    referer = request.headers.get('Referer')
    request_domain = ""
    from urllib.parse import urlparse
    if origin:
        request_domain = urlparse(origin).hostname
    elif referer:
        request_domain = urlparse(referer).hostname
    return request_domain in allowed_domains

@captcha_bp.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization'
    response.headers['X-Content-Type-Options'] = 'nosniff'
    response.headers['X-Frame-Options'] = 'SAMEORIGIN'
    return response

@lru_cache(maxsize=1000)
def check_ip_vpn(client_ip):
    if not client_ip or client_ip == '127.0.0.1':
        return False
    try:
        import urllib.request
        import json
        req = urllib.request.Request(f"http://ip-api.com/json/{client_ip}?fields=proxy,hosting", headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=2) as response:
            ip_data = json.loads(response.read().decode())
            if ip_data.get('proxy') or ip_data.get('hosting'):
                return True
    except Exception:
        pass
    return False

def upsert_captcha_log(site_key, status, risk_score, client_ip, vpn_detected, telemetry=None):
    from models import CaptchaLog
    from datetime import datetime
    from extensions import db
    try:
        if telemetry is None:
            telemetry = {}
        log_entry = CaptchaLog.query.filter_by(site_key=site_key).first()
        if not log_entry:
            log_entry = CaptchaLog(site_key=site_key)
            db.session.add(log_entry)
            
        log_entry.timestamp = datetime.utcnow()
        log_entry.status = status
        log_entry.risk_score = float(f"{risk_score:.2f}")
        log_entry.client_ip = client_ip
        log_entry.vpn_detected = vpn_detected
        if 'timeOnPage' in telemetry: log_entry.time_on_page = telemetry['timeOnPage']
        if 'mouseScore' in telemetry: log_entry.mouse_score = telemetry['mouseScore']
        if 'hardwareConcurrency' in telemetry: log_entry.hardware_concurrency = telemetry['hardwareConcurrency']
        if 'deviceMemory' in telemetry: log_entry.device_memory = telemetry['deviceMemory']
        if 'url' in telemetry: log_entry.website_url = telemetry['url']
        elif not log_entry.website_url: log_entry.website_url = 'Unknown'
        
        db.session.commit()
    except Exception as e:
        import logging
        logging.error(f"Failed to upsert captcha log: {e}")
        db.session.rollback()

@captcha_bp.route('/challenge', methods=['POST', 'OPTIONS'])
@limiter.limit("20 per minute")
def challenge():
    """Endpoint called by the widget to obtain a token after 'solving' the captcha."""
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json()
    if not data:
        return jsonify({"success": False, "error": "Invalid JSON"}), 400
        
    site_key = data.get('sitekey')
    telemetry_raw = data.get('telemetry', '')
    
    import base64
    import json
    telemetry = {}
    if telemetry_raw and isinstance(telemetry_raw, str):
        try:
            # Decrypt/Deobfuscate payload
            payload_str = base64.b64decode(telemetry_raw).decode('utf-8')
            result = ""
            for i, char in enumerate(payload_str):
                key_char = site_key[i % len(site_key)]
                result += chr(ord(char) ^ ord(key_char))
            telemetry = json.loads(result)
        except Exception:
            try:
                # Fallback for raw base64 (old clients or testing)
                telemetry = json.loads(base64.b64decode(telemetry_raw).decode('utf-8'))
            except Exception:
                pass
    elif isinstance(telemetry_raw, dict):
        telemetry = telemetry_raw
    
    if not site_key:
        return jsonify({"success": False, "error": "Missing sitekey"}), 400
        
    app = get_app_by_sitekey(site_key)
    if not app:
        return jsonify({"success": False, "error": "Invalid sitekey"}), 400

    if not is_domain_authorized(app.domains, request):
        return jsonify({"success": False, "error": "Domain not authorized"}), 403

    # Increment challenges
    if not getattr(app, 'is_test', False):
        app.total_challenges = (app.total_challenges or 0) + 1
        db.session.add(app)
        try:
            db.session.commit()
        except Exception as e:
            import logging
            logging.error(f"Failed to commit challenge increment: {e}")
            db.session.rollback()

    # 2. Intelligence: Probabilistic Telemetry Analysis
    risk_score = 0.0
    
    if telemetry.get('webdriver'):
        risk_score += 1.0
        
    if telemetry.get('honeypot'):
        risk_score += 1.0
        
    if telemetry.get('forceVisual'):
        risk_score += 0.4
        
    # Time-to-solve check (if less than 300ms, extremely suspicious)
    time_on_page = telemetry.get('timeOnPage', 0)
    if time_on_page < 300:
        risk_score += 0.8
    elif time_on_page < 1000:
        risk_score += 0.3
        
    # WebGL Fingerprint analysis
    webgl = telemetry.get('webglRenderer', '').lower()
    if 'swiftshader' in webgl or 'llvmpipe' in webgl or 'mesa' in webgl or webgl == '':
        risk_score += 0.4
    
    mouse_score = telemetry.get('mouseScore', 0)
    risk_score += min(0.3, mouse_score / 300.0)
    
    canvas_fp = telemetry.get('canvasFingerprint', '')
    if not canvas_fp or len(canvas_fp) < 20:
        risk_score += 0.1
        
    typing_cadence = telemetry.get('typingCadence', [])
    if typing_cadence and len(typing_cadence) > 5:
        mean = sum(typing_cadence) / len(typing_cadence)
        variance = sum((x - mean) ** 2 for x in typing_cadence) / len(typing_cadence)
        std_dev = math.sqrt(variance)
        if std_dev < 15:
            risk_score += 0.2
    
    touch_pressures = telemetry.get('touchPressures', [])
    if touch_pressures and len(touch_pressures) > 2:
        if len(set(touch_pressures)) == 1:
            risk_score += 0.1

    hardware_concurrency = telemetry.get('hardwareConcurrency', 0)
    if hardware_concurrency == 0 or hardware_concurrency > 128:
        risk_score += 0.2
        
    device_memory = telemetry.get('deviceMemory', 0)
    if device_memory == 0 or device_memory > 256:
        risk_score += 0.2
        
    audio_fingerprint = telemetry.get('audioFingerprint', '')
    if not audio_fingerprint or audio_fingerprint == "0":
        risk_score += 0.15
        
    max_mouse_velocity = telemetry.get('maxMouseVelocity', 0)
    if max_mouse_velocity > 15: # Unnatural teleportation
        risk_score += 0.4
        
    click_durations = telemetry.get('clickDurations', [])
    if click_durations:
        avg_click = sum(click_durations) / len(click_durations)
        if avg_click < 20: # Bot clicking instantly
            risk_score += 0.3

    pow_data = telemetry.get('pow', {})
    if not pow_data:
        risk_score += 1.0 # No PoW provided
    else:
        nonce = pow_data.get('nonce')
        timestamp_pow = pow_data.get('timestamp')
        hash_hex = pow_data.get('hashHex')
        
        if nonce is None or not timestamp_pow or not hash_hex:
            risk_score += 1.0
        else:
            import time
            if (time.time() * 1000) - timestamp_pow > 300000: # 5 minutes old
                risk_score += 1.0
            else:
                import hashlib
                msg = f"{site_key}{timestamp_pow}{nonce}".encode('utf-8')
                expected_hash = hashlib.sha256(msg).hexdigest()
                if expected_hash != hash_hex or not hash_hex.startswith("0000"):
                    risk_score += 1.0

    # 3. Intelligence: VPN & Datacenter IP Detection
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    vpn_detected = check_ip_vpn(client_ip)
    
    if vpn_detected:
        risk_score += 0.3
            
    if app.block_vpns and vpn_detected:
        upsert_captcha_log(site_key, "FAIL", risk_score, client_ip, vpn_detected, telemetry)
        return jsonify({"success": False, "error": "VPNs and Proxies are blocked by this application."}), 403

    # Check if Visual Challenge is required
    requires_visual = False
    
    if getattr(app, 'is_test', False):
        if app.test_type == 'pass':
            risk_score = 0.0
            requires_visual = False
        elif app.test_type == 'fail':
            risk_score = 1.0
        # 'auto' continues normally
        
    risk_score = min(1.0, risk_score)
    if risk_score >= 0.85:
        from datetime import datetime
        stats = f"IP: {client_ip} | VPN: {'Yes' if vpn_detected else 'No'} | TimeOnPage: {telemetry.get('timeOnPage', 'N/A')}ms | MouseScore: {telemetry.get('mouseScore', 'N/A')} | HW: {telemetry.get('hardwareConcurrency', 'N/A')}C/{telemetry.get('deviceMemory', 'N/A')}GB"
        print(f"[CAPTCHA] Challenge Validation [FAIL] (Risk: {risk_score:.2f}) | Time: {datetime.utcnow().isoformat()}Z | Website: {telemetry.get('url', 'Unknown')} | {stats}")
        upsert_captcha_log(site_key, "FAIL", risk_score, client_ip, vpn_detected, telemetry)
            
        return jsonify({"success": False, "error": "Security validation failed. High risk detected."}), 403

    if getattr(app, 'under_attack_mode', False) or app.strict_mode or risk_score >= 0.4:
        requires_visual = True
        
    import hmac
    import hashlib
    
    if requires_visual:
        bg_b64, piece_b64, target_x, target_y = generate_slider_challenge()
        timestamp = str(int(time.time()))
        challenge_string = secrets.token_hex(8)
        # We store the target_x as the answer
        payload = f"{challenge_string}:{target_x}:{timestamp}"
        vis_sig = hmac.new(app.secret_key.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).hexdigest()
        visual_ticket = f"{payload}.{vis_sig}"
        upsert_captcha_log(site_key, "CHALLENGE", risk_score, client_ip, vpn_detected, telemetry)
            
        return jsonify({
            "success": False,
            "requires_visual": True,
            "visual_type": "slider",
            "bg_image": bg_b64,
            "piece_image": piece_b64,
            "piece_y": target_y,
            "visual_ticket": visual_ticket,
            "risk_score": risk_score
        })

    from datetime import datetime
    stats = f"IP: {client_ip} | VPN: {'Yes' if vpn_detected else 'No'} | TimeOnPage: {telemetry.get('timeOnPage', 'N/A')}ms | MouseScore: {telemetry.get('mouseScore', 'N/A')} | HW: {telemetry.get('hardwareConcurrency', 'N/A')}C/{telemetry.get('deviceMemory', 'N/A')}GB"
    print(f"[CAPTCHA] Challenge Validation [PASS] (Risk: {risk_score:.2f}) | Time: {datetime.utcnow().isoformat()}Z | Website: {telemetry.get('url', 'Unknown')} | {stats}")
    upsert_captcha_log(site_key, "PASS", risk_score, client_ip, vpn_detected, telemetry)

    timestamp = str(int(time.time()))
    message = f"{site_key}:{timestamp}:{risk_score}".encode('utf-8')
    signature = hmac.new(app.secret_key.encode('utf-8'), message, hashlib.sha256).hexdigest()
    
    token = f"{site_key}~{timestamp}~{risk_score}.{signature}"
    
    return jsonify({
        "success": True,
        "token": token
    })

@captcha_bp.route('/siteverify', methods=['POST'])
@limiter.limit("120 per minute")
def siteverify():
    """Endpoint called by the third-party backend to validate the token."""
    secret = request.form.get('secret') or (request.json.get('secret') if request.is_json else None)
    token = request.form.get('response') or (request.json.get('response') if request.is_json else None)
    
    if not secret or not token:
        return jsonify({
            "success": False,
            "error-codes": ["missing-input-secret" if not secret else "missing-input-response"]
        }), 400
        
    app = get_app_by_secret(secret)
    if not app:
        return jsonify({
            "success": False,
            "error-codes": ["invalid-input-secret"]
        }), 400
        
    try:
        parts = token.rsplit('.', 1)
        if len(parts) != 2:
            raise ValueError("Invalid token format")
            
        payload, signature = parts
        payload_parts = payload.split('~')
        if len(payload_parts) != 3:
            raise ValueError("Invalid payload format")
            
        token_site_key, timestamp_str, risk_score = payload_parts
        
        if token_site_key != app.site_key:
            raise ValueError("Site key mismatch")
            
        timestamp = int(timestamp_str)
        if time.time() - timestamp > 300:
            return jsonify({
                "success": False,
                "error-codes": ["timeout-or-duplicate"]
            }), 400
            
        import hmac
        import hashlib
        
        message = f"{app.site_key}:{timestamp_str}:{risk_score}".encode('utf-8')
        expected_signature = hmac.new(app.secret_key.encode('utf-8'), message, hashlib.sha256).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            raise ValueError("Invalid signature")
            
        from models import ConsumedCaptchaToken
        from datetime import datetime, timedelta
        
        if ConsumedCaptchaToken.query.filter_by(signature=signature).first():
            return jsonify({
                "success": False,
                "error-codes": ["timeout-or-duplicate"]
            }), 400
            
        expires = datetime.utcfromtimestamp(timestamp) + timedelta(seconds=300)
        db.session.add(ConsumedCaptchaToken(signature=signature, expires_at=expires))
            
        if not getattr(app, 'is_test', False):
            app.total_successes = (app.total_successes or 0) + 1
            db.session.add(app)
            try:
                db.session.commit()
            except Exception as e:
                import logging
                logging.error(f"Failed to commit siteverify success: {e}")
                db.session.rollback()
            
        print(f"[CAPTCHA] Siteverify Validation [PASS] (Risk: {risk_score})")
            
        return jsonify({
            "success": True,
            "challenge_ts": datetime.utcnow().isoformat() + "Z",
            "hostname": "localhost",
            "risk_score": float(risk_score)
        })
        
    except Exception as e:
        app.total_failures = (app.total_failures or 0) + 1
        db.session.add(app)
        try:
            db.session.commit()
        except Exception as ex:
            import logging
            logging.error(f"Failed to commit siteverify failure: {ex}")
            db.session.rollback()
            
        print(f"[CAPTCHA] Siteverify Validation [FAIL] (Reason: {str(e)})")
            
        return jsonify({
            "success": False,
            "error-codes": ["invalid-input-response"]
        }), 400

@captcha_bp.route('/visual-verify', methods=['POST', 'OPTIONS'])
@limiter.limit("20 per minute")
def visual_verify():
    """Validates the Visual Challenge and issues the token if valid."""
    if request.method == 'OPTIONS':
        return '', 204
        
    data = request.get_json()
    site_key = data.get('sitekey')
    visual_ticket = data.get('visual_ticket')
    answer = data.get('answer', '')
    
    app = get_app_by_sitekey(site_key)
    if not app:
        return jsonify({"success": False, "error": "Invalid sitekey"}), 400
        
    if not is_domain_authorized(app.domains, request):
        return jsonify({"success": False, "error": "Domain not authorized"}), 403
        
    if not visual_ticket or not answer:
        return jsonify({"success": False, "error": "Missing parameters"}), 400
        
    import hmac
    import hashlib
    
    try:
        challenge_string, rest = visual_ticket.split(':', 1)
        payload_body, vis_sig = rest.rsplit('.', 1)
        
        # Backward compatibility for old tickets without timestamp
        if ':' in payload_body:
            expected_ans, timestamp_str = payload_body.split(':')
            timestamp = int(timestamp_str)
            import time
            if time.time() - timestamp > 300:
                raise ValueError("Ticket expired")
            payload = f"{challenge_string}:{expected_ans}:{timestamp_str}"
        else:
            expected_ans = payload_body
            payload = f"{challenge_string}:{expected_ans}"
            timestamp = int(time.time()) # fallback for consumption logic
        
        expected_sig = hmac.new(app.secret_key.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(vis_sig, expected_sig):
            raise ValueError("Invalid signature")
            
        from models import ConsumedCaptchaToken
        from datetime import datetime, timedelta
        
        if ConsumedCaptchaToken.query.filter_by(signature=vis_sig).first():
            raise ValueError("Ticket already used")
            
        expires = datetime.utcfromtimestamp(timestamp) + timedelta(seconds=300)
        db.session.add(ConsumedCaptchaToken(signature=vis_sig, expires_at=expires))
            
    except Exception as ex:
        app.total_failures = (app.total_failures or 0) + 1
        db.session.add(app)
        upsert_captcha_log(site_key, "FAIL", 1.0, request.headers.get("X-Forwarded-For", request.remote_addr), check_ip_vpn(request.headers.get("X-Forwarded-For", request.remote_addr)))
        return jsonify({"success": False, "error": "Invalid ticket"}), 400
        
    # Validation for slider offset
    try:
        submitted_x = float(answer)
        expected_x = float(expected_ans)
        # Tolerance of +/- 4 pixels
        is_valid = abs(submitted_x - expected_x) <= 4.0
    except ValueError:
        is_valid = False
        
    if not is_valid:
        app.total_failures = (app.total_failures or 0) + 1
        db.session.add(app)
        upsert_captcha_log(site_key, "FAIL", 1.0, request.headers.get("X-Forwarded-For", request.remote_addr), check_ip_vpn(request.headers.get("X-Forwarded-For", request.remote_addr)))
        return jsonify({"success": False, "error": "Incorrect answer"}), 400
        
    risk_score = 0.35
    import time
    timestamp = str(int(time.time()))
    message = f"{site_key}:{timestamp}:{risk_score}".encode('utf-8')
    signature = hmac.new(app.secret_key.encode('utf-8'), message, hashlib.sha256).hexdigest()
    
    token = f"{site_key}~{timestamp}~{risk_score}.{signature}"
    upsert_captcha_log(site_key, "PASS", risk_score, request.headers.get("X-Forwarded-For", request.remote_addr), check_ip_vpn(request.headers.get("X-Forwarded-For", request.remote_addr)))
    
    return jsonify({
        "success": True,
        "token": token
    })

@captcha_bp.route('/stats', methods=['GET'])
def get_stats():
    site_key = request.args.get('sitekey')
    secret_key = request.args.get('secret')
    
    if not site_key or not secret_key:
        return jsonify({"success": False, "error": "Missing credentials"}), 400
        
    app_data = get_app_by_sitekey(site_key)
    if not app_data or app_data.secret_key != secret_key:
        return jsonify({"success": False, "error": "Invalid credentials"}), 403
        
    from models import CaptchaLog
    # Fetch up to 1000 recent logs to calculate averages
    logs = CaptchaLog.query.filter_by(site_key=site_key).order_by("timestamp desc").limit(1000).all()
    
    total_logs = len(logs)
    if total_logs == 0:
        return jsonify({
            "success": True, 
            "global_stats": {
                "total_challenges": app_data.total_challenges or 0,
                "total_successes": app_data.total_successes or 0,
                "total_failures": app_data.total_failures or 0
            },
            "recent_stats": {}, 
            "recent_logs": []
        })
        
    avg_risk = sum((log.risk_score or 0.0) for log in logs) / total_logs
    avg_mouse = sum((log.mouse_score or 0) for log in logs) / total_logs
    avg_time = sum((log.time_on_page or 0) for log in logs) / total_logs
    vpn_count = sum(1 for log in logs if log.vpn_detected)
    
    global_stats = {
        "total_challenges": app_data.total_challenges or 0,
        "total_successes": app_data.total_successes or 0,
        "total_failures": app_data.total_failures or 0,
        "average_risk_score": round(avg_risk, 2)
    }
    
    recent_stats = {
        "analyzed_logs": total_logs,
        "average_mouse_score": round(avg_mouse, 2),
        "average_time_on_page_ms": round(avg_time, 2),
        "vpn_detected_count": vpn_count
    }
    
    recent_logs = []
    for log in logs[:10]:
        recent_logs.append({
            "timestamp": log.timestamp.isoformat() + "Z" if log.timestamp else None,
            "status": log.status,
            "risk_score": log.risk_score,
            "client_ip": log.client_ip,
            "vpn_detected": log.vpn_detected,
            "time_on_page": log.time_on_page,
            "mouse_score": log.mouse_score,
            "hardware_concurrency": log.hardware_concurrency,
            "device_memory": log.device_memory,
            "website_url": log.website_url
        })
        
    return jsonify({
        "success": True,
        "global_stats": global_stats,
        "recent_stats": recent_stats,
        "recent_logs": recent_logs
    })
