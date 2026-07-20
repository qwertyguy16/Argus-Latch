from flask import Blueprint, request, jsonify, render_template, make_response, url_for
from models import CaptchaApplication
from extensions import db, limiter
import secrets
import time
import math
from datetime import datetime
from functools import lru_cache

captcha_bp = Blueprint('captcha', __name__, url_prefix='/captcha')

def generate_visual_challenge():
    import io
    import base64
    import random
    import string
    import math
    from PIL import Image, ImageDraw, ImageFont, ImageFilter
    
    # Random text length between 5 and 6
    text = ''.join(random.choices(string.ascii_uppercase + string.digits, k=random.randint(5, 6)))
    width, height = 200, 70
    img = Image.new('RGB', (width, height), color=(240, 240, 240))
    d = ImageDraw.Draw(img)
    
    try:
        font = ImageFont.truetype("arial.ttf", 36)
    except IOError:
        font = ImageFont.load_default()
        
    # Draw background noise first
    for _ in range(400):
        d.point((random.randint(0, width), random.randint(0, height)), fill=(random.randint(100, 200), random.randint(100, 200), random.randint(100, 200)))
        
    # Add interference curves (sine waves)
    for _ in range(4):
        amplitude = random.randint(5, 15)
        frequency = random.uniform(0.02, 0.08)
        phase = random.uniform(0, math.pi * 2)
        y_offset = random.randint(20, height - 20)
        
        points = []
        for x in range(0, width, 2):
            y = y_offset + int(amplitude * math.sin(frequency * x + phase))
            points.append((x, y))
            
        color = (random.randint(100, 180), random.randint(100, 180), random.randint(100, 180))
        d.line(points, fill=color, width=random.randint(1, 3))
        
    # Draw text with rotation and scaling
    char_spacing = (width - 40) // len(text)
    for i, char in enumerate(text):
        char_img = Image.new('RGBA', (50, 50), (255, 255, 255, 0))
        char_draw = ImageDraw.Draw(char_img)
        char_color = (random.randint(0, 100), random.randint(0, 100), random.randint(0, 100), 255)
        
        char_draw.text((10, 5), char, fill=char_color, font=font)
        
        # Rotate and slightly scale
        angle = random.randint(-35, 35)
        char_img = char_img.rotate(angle, expand=0, resample=Image.BICUBIC)
        
        x = 20 + i * char_spacing + random.randint(-5, 5)
        y = 5 + random.randint(-8, 8)
        
        img.paste(char_img, (x, y), char_img)
    
    # Add foreground noise
    for _ in range(200):
        d.point((random.randint(0, width), random.randint(0, height)), fill=(random.randint(0, 150), random.randint(0, 150), random.randint(0, 150)))
        
    # Apply a slight blur
    img = img.filter(ImageFilter.GaussianBlur(1.0))
    
    buf = io.BytesIO()
    img.save(buf, format='PNG')
    img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    return text, img_b64

@captcha_bp.route('/api.js')
def api_js():
    """Serves the JavaScript for the Captcha widget."""
    response = make_response(render_template('api/captcha_api.js'))
    response.headers['Content-Type'] = 'application/javascript'
    return response

@captcha_bp.route('/settings', methods=['GET', 'OPTIONS'])
@limiter.limit("60 per minute")
def get_settings():
    """Returns the captcha settings for a specific sitekey."""
    if request.method == 'OPTIONS':
        return '', 204
        
    site_key = request.args.get('sitekey')
    if not site_key:
        return jsonify({"success": False, "error": "Missing sitekey"}), 400
        
    app = CaptchaApplication.query.filter_by(site_key=site_key).first()
    if not app:
        return jsonify({"success": False, "error": "Invalid sitekey"}), 400
        
    if not is_domain_authorized(app.domains, request):
        return jsonify({"success": False, "error": "Domain not authorized"}), 403
        
    return jsonify({
        "success": True,
        "theme": app.theme or 'auto',
        "mode": app.mode or 'manual'
    })

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
    origin = request.headers.get('Origin')
    if origin:
        response.headers['Access-Control-Allow-Origin'] = origin
    else:
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
            telemetry = json.loads(base64.b64decode(telemetry_raw).decode('utf-8'))
        except Exception:
            pass
    elif isinstance(telemetry_raw, dict):
        telemetry = telemetry_raw
    
    if not site_key:
        return jsonify({"success": False, "error": "Missing sitekey"}), 400
        
    app = CaptchaApplication.query.filter_by(site_key=site_key).first()
    if not app:
        return jsonify({"success": False, "error": "Invalid sitekey"}), 400

    if not is_domain_authorized(app.domains, request):
        return jsonify({"success": False, "error": "Domain not authorized"}), 403

    # Increment challenges
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

    # 3. Intelligence: VPN & Datacenter IP Detection
    client_ip = request.headers.get('X-Forwarded-For', request.remote_addr)
    vpn_detected = check_ip_vpn(client_ip)
    
    if vpn_detected:
        risk_score += 0.3
            
    if app.block_vpns and vpn_detected:
        return jsonify({"success": False, "error": "VPNs and Proxies are blocked by this application."}), 403

    risk_score = min(1.0, risk_score)
    if risk_score >= 0.85:
        return jsonify({"success": False, "error": "Security validation failed. High risk detected."}), 403

    # Check if Visual Challenge is required
    requires_visual = False
    if app.strict_mode or risk_score >= 0.4:
        requires_visual = True
        
    import hmac
    import hashlib
    
    if requires_visual:
        text_ans, img_b64 = generate_visual_challenge()
        timestamp = str(int(time.time()))
        challenge_string = secrets.token_hex(8)
        payload = f"{challenge_string}:{text_ans}:{timestamp}"
        vis_sig = hmac.new(app.secret_key.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).hexdigest()
        visual_ticket = f"{payload}.{vis_sig}"
        return jsonify({
            "success": False,
            "requires_visual": True,
            "image": img_b64,
            "visual_ticket": visual_ticket,
            "risk_score": risk_score
        })

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
        
    app = CaptchaApplication.query.filter_by(secret_key=secret).first()
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
            
        app.total_successes = (app.total_successes or 0) + 1
        db.session.add(app)
        try:
            db.session.commit()
        except Exception as e:
            import logging
            logging.error(f"Failed to commit siteverify success: {e}")
            db.session.rollback()
            
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
        except Exception as e:
            import logging
            logging.error(f"Failed to commit siteverify failure: {e}")
            db.session.rollback()
            
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
    
    app = CaptchaApplication.query.filter_by(site_key=site_key).first()
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
        try:
            db.session.commit()
        except Exception as e:
            import logging
            logging.error(f"Failed to commit visual ticket failure: {e}")
            db.session.rollback()
        return jsonify({"success": False, "error": "Invalid ticket"}), 400
        
    if answer.strip().upper() != expected_ans.upper():
        app.total_failures = (app.total_failures or 0) + 1
        db.session.add(app)
        try:
            db.session.commit()
        except Exception as e:
            import logging
            logging.error(f"Failed to commit visual incorrect answer: {e}")
            db.session.rollback()
        return jsonify({"success": False, "error": "Incorrect answer"}), 400
        
    risk_score = 0.35
    import time
    timestamp = str(int(time.time()))
    message = f"{site_key}:{timestamp}:{risk_score}".encode('utf-8')
    signature = hmac.new(app.secret_key.encode('utf-8'), message, hashlib.sha256).hexdigest()
    
    token = f"{site_key}~{timestamp}~{risk_score}.{signature}"
    
    return jsonify({
        "success": True,
        "token": token
    })
