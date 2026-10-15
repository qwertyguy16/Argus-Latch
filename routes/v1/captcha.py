from flask import Blueprint, request, jsonify, render_template, make_response, url_for
from models import CaptchaApplication
from extensions import db, limiter, get_client_ip
import secrets
import time
import math
import hmac
import hashlib
import json
from datetime import datetime, timedelta
from functools import lru_cache

captcha_bp = Blueprint('captcha', __name__, url_prefix='/captcha')

TEST_KEYS = {
    'argus_1x000000000000000000000000': {'secret': 'sk_1x000000000000000000000000', 'type': 'pass'},
    'argus_2x000000000000000000000000': {'secret': 'sk_2x000000000000000000000000', 'type': 'fail'},
    'argus_3x000000000000000000000000': {'secret': 'sk_3x000000000000000000000000', 'type': 'auto'},
    'argus_4x000000000000000000000000': {'secret': 'sk_4x000000000000000000000000', 'type': 'slider'},
    'argus_5x000000000000000000000000': {'secret': 'sk_5x000000000000000000000000', 'type': 'rotation'},
    'argus_6x000000000000000000000000': {'secret': 'sk_6x000000000000000000000000', 'type': 'audio'},
    'argus_7x000000000000000000000000': {'secret': 'sk_7x000000000000000000000000', 'type': 'error'}
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
    if not site_key:
        return None
    site_key = site_key.strip()
    if site_key in TEST_KEYS:
        data = TEST_KEYS[site_key]
        return MockTestApp(site_key, data['secret'], data['type'])
    try:
        return CaptchaApplication.query.filter_by(site_key=site_key).first()
    except Exception as e:
        import logging
        logging.error(f"Error querying CaptchaApplication by site_key '{site_key}': {e}")
        return None

def get_app_by_secret(secret_key):
    if not secret_key:
        return None
    secret_key = secret_key.strip()
    for sk, data in TEST_KEYS.items():
        if data['secret'] == secret_key:
            return MockTestApp(sk, secret_key, data['type'])
    try:
        return CaptchaApplication.query.filter_by(secret_key=secret_key).first()
    except Exception as e:
        import logging
        logging.error(f"Error querying CaptchaApplication by secret_key: {e}")
        return None

def is_domain_authorized(app_domains, request):
    if not app_domains:
        return True
    from urllib.parse import urlparse
    allowed_domains = set()
    for d in app_domains.split(','):
        d_clean = d.strip().lower()
        if not d_clean:
            continue
        allowed_domains.add(d_clean)
        try:
            parsed_d = urlparse(d_clean if '//' in d_clean else f'//{d_clean}')
            if parsed_d.hostname:
                allowed_domains.add(parsed_d.hostname.lower())
        except Exception:
            pass

    if not allowed_domains:
        return True

    origin = request.headers.get('Origin')
    referer = request.headers.get('Referer')
    request_domain = ""
    if origin and origin != 'null':
        try:
            request_domain = (urlparse(origin).hostname or "").lower()
        except Exception:
            pass
    elif referer:
        try:
            request_domain = (urlparse(referer).hostname or "").lower()
        except Exception:
            pass

    if not request_domain:
        return True

    return (
        request_domain in allowed_domains
        or f"www.{request_domain}" in allowed_domains
        or request_domain.replace('www.', '') in allowed_domains
    )
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

def generate_rotation_challenge():
    import io
    import base64
    import random
    from PIL import Image, ImageDraw

    objects = ['house', 'sailboat', 'rocket', 'coffee', 'tree', 'umbrella', 'car']
    obj = random.choice(objects)
    size = 400
    cx, cy = size // 2, size // 2

    img = Image.new('RGBA', (size, size), (255, 255, 255, 0))
    d = ImageDraw.Draw(img)
    # Background circular card
    d.ellipse((25, 25, size - 25, size - 25), fill=(245, 248, 252, 255), outline=(203, 213, 225, 255), width=6)

    if obj == 'house':
        d.rectangle([cx - 70, cy - 10, cx + 70, cy + 90], fill=(254, 243, 199, 255), outline=(217, 119, 6, 255), width=4)
        d.polygon([(cx - 90, cy - 10), (cx, cy - 100), (cx + 90, cy - 10)], fill=(220, 38, 38, 255), outline=(153, 27, 27, 255))
        d.rectangle([cx + 35, cy - 90, cx + 65, cy - 40], fill=(185, 28, 28, 255), outline=(153, 27, 27, 255), width=3)
        d.ellipse([cx + 42, cy - 110, cx + 58, cy - 95], fill=(203, 213, 225, 180))
        d.ellipse([cx + 50, cy - 128, cx + 72, cy - 110], fill=(203, 213, 225, 160))
        d.rounded_rectangle([cx - 20, cy + 30, cx + 20, cy + 90], radius=5, fill=(120, 53, 15, 255))
        d.ellipse([cx + 8, cy + 60, cx + 16, cy + 68], fill=(251, 191, 36, 255))
        d.rectangle([cx - 55, cy + 15, cx - 25, cy + 45], fill=(186, 230, 253, 255), outline=(56, 189, 248, 255), width=3)
        d.rounded_rectangle([cx - 100, cy + 90, cx + 100, cy + 105], radius=6, fill=(34, 197, 94, 255))

    elif obj == 'sailboat':
        d.rounded_rectangle([cx - 120, cy + 65, cx + 120, cy + 95], radius=10, fill=(59, 130, 246, 200))
        d.rounded_rectangle([cx - 100, cy + 85, cx + 100, cy + 105], radius=10, fill=(37, 99, 235, 220))
        d.polygon([(cx - 80, cy + 25), (cx + 80, cy + 25), (cx + 55, cy + 65), (cx - 55, cy + 65)], fill=(180, 83, 9, 255), outline=(120, 53, 15, 255))
        d.rectangle([cx - 4, cy - 110, cx + 4, cy + 25], fill=(100, 116, 139, 255))
        d.polygon([(cx + 6, cy - 100), (cx + 6, cy + 15), (cx + 75, cy + 15)], fill=(255, 255, 255, 255), outline=(203, 213, 225, 255), width=3)
        d.polygon([(cx - 6, cy - 75), (cx - 6, cy + 15), (cx - 60, cy + 15)], fill=(241, 245, 249, 255), outline=(203, 213, 225, 255), width=3)
        d.polygon([(cx, cy - 110), (cx + 30, cy - 102), (cx, cy - 95)], fill=(239, 68, 68, 255))

    elif obj == 'rocket':
        d.polygon([(cx - 20, cy + 55), (cx + 20, cy + 55), (cx, cy + 120)], fill=(245, 158, 11, 255))
        d.polygon([(cx - 10, cy + 55), (cx + 10, cy + 55), (cx, cy + 95)], fill=(254, 240, 138, 255))
        d.polygon([(cx - 30, cy + 20), (cx - 75, cy + 65), (cx - 30, cy + 60)], fill=(220, 38, 38, 255))
        d.polygon([(cx + 30, cy + 20), (cx + 75, cy + 65), (cx + 30, cy + 60)], fill=(220, 38, 38, 255))
        d.rounded_rectangle([cx - 32, cy - 35, cx + 32, cy + 60], radius=16, fill=(248, 250, 252, 255), outline=(148, 163, 184, 255), width=4)
        d.polygon([(cx - 32, cy - 30), (cx, cy - 115), (cx + 32, cy - 30)], fill=(220, 38, 38, 255), outline=(153, 27, 27, 255), width=3)
        d.ellipse([cx - 16, cy - 10, cx + 16, cy + 22], fill=(14, 165, 233, 255), outline=(203, 213, 225, 255), width=4)
        d.ellipse([cx - 6, cy - 4, cx + 2, cy + 4], fill=(255, 255, 255, 200))

    elif obj == 'coffee':
        d.ellipse([cx - 85, cy + 60, cx + 85, cy + 85], fill=(226, 232, 240, 255), outline=(148, 163, 184, 255), width=4)
        d.rounded_rectangle([cx - 60, cy - 25, cx + 45, cy + 68], radius=22, fill=(168, 85, 247, 255), outline=(126, 34, 206, 255), width=4)
        d.arc([cx + 25, cy - 10, cx + 80, cy + 45], start=-90, end=90, fill=(126, 34, 206, 255), width=10)
        d.ellipse([cx - 56, cy - 28, cx + 41, cy - 14], fill=(120, 53, 15, 255))
        for offset_x in [-25, 0, 20]:
            d.arc([cx + offset_x - 15, cy - 90, cx + offset_x + 15, cy - 40], start=-60, end=120, fill=(148, 163, 184, 160), width=4)

    elif obj == 'tree':
        d.rounded_rectangle([cx - 95, cy + 80, cx + 95, cy + 100], radius=8, fill=(101, 163, 13, 255))
        d.polygon([(cx - 16, cy - 10), (cx + 16, cy - 10), (cx + 26, cy + 85), (cx - 26, cy + 85)], fill=(120, 53, 15, 255))
        d.ellipse([cx - 85, cy - 65, cx - 10, cy + 15], fill=(22, 163, 74, 255))
        d.ellipse([cx + 10, cy - 65, cx + 85, cy + 15], fill=(22, 163, 74, 255))
        d.ellipse([cx - 65, cy - 110, cx + 65, cy - 10], fill=(34, 197, 94, 255))
        for ax, ay in [(cx - 35, cy - 40), (cx + 25, cy - 45), (cx - 5, cy - 80), (cx + 35, cy - 15), (cx - 45, cy - 10)]:
            d.ellipse([ax - 7, ay - 7, ax + 7, ay + 7], fill=(239, 68, 68, 255))

    elif obj == 'umbrella':
        for dx, dy in [(-70, -30), (70, -20), (-85, 30), (80, 40), (-60, 70), (70, 80)]:
            d.ellipse([cx + dx, cy + dy, cx + dx + 6, cy + dy + 12], fill=(96, 165, 250, 200))
        d.pieslice([cx - 95, cy - 90, cx + 95, cy + 30], start=180, end=360, fill=(239, 68, 68, 255), outline=(185, 28, 28, 255), width=4)
        d.pieslice([cx - 95, cy - 90, cx + 95, cy + 30], start=225, end=315, fill=(245, 158, 11, 255))
        d.rectangle([cx - 3, cy - 102, cx + 3, cy - 88], fill=(148, 163, 184, 255))
        d.rectangle([cx - 4, cy - 30, cx + 4, cy + 60], fill=(71, 85, 105, 255))
        d.arc([cx - 24, cy + 45, cx + 4, cy + 85], start=0, end=180, fill=(71, 85, 105, 255), width=8)

    elif obj == 'car':
        d.rounded_rectangle([cx - 110, cy + 70, cx + 110, cy + 85], radius=6, fill=(100, 116, 139, 255))
        d.rounded_rectangle([cx - 85, cy + 15, cx + 85, cy + 55], radius=10, fill=(239, 68, 68, 255), outline=(185, 28, 28, 255), width=3)
        d.polygon([(cx - 55, cy + 15), (cx - 35, cy - 30), (cx + 35, cy - 30), (cx + 60, cy + 15)], fill=(220, 38, 38, 255), outline=(185, 28, 28, 255), width=3)
        d.polygon([(cx - 30, cy - 25), (cx - 5, cy - 25), (cx - 5, cy + 12), (cx - 45, cy + 12)], fill=(186, 230, 253, 255))
        d.polygon([(cx + 5, cy - 25), (cx + 28, cy - 25), (cx + 48, cy + 12), (cx + 5, cy + 12)], fill=(186, 230, 253, 255))
        d.rounded_rectangle([cx + 78, cy + 22, cx + 87, cy + 34], radius=3, fill=(254, 240, 138, 255))
        for wx in [cx - 50, cx + 50]:
            d.ellipse([wx - 22, cy + 40, wx + 22, cy + 78], fill=(30, 41, 59, 255), outline=(15, 23, 42, 255), width=3)
            d.ellipse([wx - 10, cy + 50, wx + 10, cy + 68], fill=(203, 213, 225, 255))

    target_angle = random.choice([30, 45, 60, 90, 120, 135, 150, 180, 210, 225, 240, 270, 300, 315, 330])
    # Rotate clockwise by target_angle (PIL rotate angle is counter-clockwise, so use -target_angle)
    rotated_img = img.rotate(-target_angle, resample=Image.Resampling.BICUBIC)
    final_img = rotated_img.resize((240, 240), Image.Resampling.LANCZOS)

    buf = io.BytesIO()
    final_img.save(buf, format='PNG')
    img_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')

    return img_b64, target_angle

def generate_audio_challenge():
    import os
    import io
    import wave
    import random
    import base64
    import numpy as np
    from flask import current_app

    # 4 to 6 random digits
    num_digits = random.randint(4, 6)
    digits = [random.randint(0, 9) for _ in range(num_digits)]
    digits_str = ''.join(str(d) for d in digits)

    samples_dir = os.path.join(current_app.root_path, 'audio_samples')
    rate = 22050

    combined = []
    # Initial pause
    combined.append(np.zeros(int(rate * random.uniform(0.2, 0.35)), dtype=np.int16))

    for i, d in enumerate(digits):
        path = os.path.join(samples_dir, f'digit_{d}.wav')
        if os.path.exists(path):
            with wave.open(path, 'rb') as w:
                data = w.readframes(w.getnframes())
                arr = np.frombuffer(data, dtype=np.int16).copy()

                # Micro-jitter: slight speed/duration variation (0.93 - 1.07)
                resample_ratio = random.uniform(0.93, 1.07)
                new_len = int(len(arr) * resample_ratio)
                indices = np.linspace(0, len(arr) - 1, new_len)
                arr = np.interp(indices, np.arange(len(arr)), arr).astype(np.float32)

                # Individual digit volume variation (0.80 - 1.15)
                vol_gain = random.uniform(0.80, 1.15)
                arr = np.clip(arr * vol_gain, -32767, 32767).astype(np.int16)
                combined.append(arr)
        else:
            freq = 400 + d * 80
            dur = random.uniform(0.35, 0.45)
            t = np.linspace(0, dur, int(rate * dur), endpoint=False)
            tone = (16000 * np.sin(2 * np.pi * freq * t)).astype(np.int16)
            combined.append(tone)

        # Varied pause between digits (0.22s to 0.42s)
        if i < len(digits) - 1:
            pause_frames = int(rate * random.uniform(0.22, 0.42))
            combined.append(np.zeros(pause_frames, dtype=np.int16))

    # Trailing pause
    combined.append(np.zeros(int(rate * random.uniform(0.25, 0.4)), dtype=np.int16))
    full_audio = np.concatenate(combined).astype(np.float32)

    total_len = len(full_audio)
    t = np.arange(total_len) / rate

    # 1. Multi-layered Acoustic Static / Radio Noise (challenging for Whisper/ASR)
    # White noise (RF static / atmospheric hiss):
    white_noise = np.random.normal(0, 2800, total_len).astype(np.float32)
    # Moving average for pink/brown low-pass rumble (chassis/ambient room rumble):
    kernel_size = 11
    kernel = np.ones(kernel_size) / kernel_size
    brown_rumble = np.convolve(np.random.normal(0, 3600, total_len + kernel_size - 1), kernel, mode='valid')

    # 2. Power Line Hum & Harmonics (60Hz, 120Hz, 180Hz)
    hum = (
        1200 * np.sin(2 * np.pi * 60 * t) +
        600 * np.sin(2 * np.pi * 120 * t + 0.4) +
        300 * np.sin(2 * np.pi * 180 * t + 0.8)
    )

    # 3. Dynamic FM Sweep / Acoustic Warble (interferes with Mel filterbanks)
    sweep_rate = random.uniform(0.3, 0.6)
    fm_center = random.uniform(340, 460)
    sweep = 1100 * np.sin(2 * np.pi * (fm_center + 70 * np.sin(2 * np.pi * sweep_rate * t)) * t)

    # 4. Vinyl crackle / acoustic pops (sporadic impulse interference)
    crackles = np.zeros(total_len, dtype=np.float32)
    num_pops = random.randint(40, 70)
    pop_indices = np.random.randint(0, total_len, size=num_pops)
    pop_amps = np.random.uniform(7000, 14000, size=num_pops) * np.random.choice([-1, 1], size=num_pops)
    crackles[pop_indices] = pop_amps

    # 5. Background Voice Murmur (cocktail party defense)
    try:
        murmur_samples = []
        for _ in range(3):
            rnd_d = random.randint(0, 9)
            m_path = os.path.join(samples_dir, f'digit_{rnd_d}.wav')
            if os.path.exists(m_path):
                with wave.open(m_path, 'rb') as mw:
                    m_data = mw.readframes(mw.getnframes())
                    m_arr = np.frombuffer(m_data, dtype=np.int16)[::-1].astype(np.float32) * 0.22
                    murmur_samples.append(m_arr)
        if murmur_samples:
            murmur_full = np.tile(np.concatenate(murmur_samples), int(np.ceil(total_len / sum(len(x) for x in murmur_samples)) + 1))[:total_len]
        else:
            murmur_full = np.zeros(total_len, dtype=np.float32)
    except Exception:
        murmur_full = np.zeros(total_len, dtype=np.float32)

    # Mix speech signal with composite noise defenses
    mixed = full_audio + white_noise + brown_rumble + hum + sweep + crackles + murmur_full
    final_pcm = np.clip(mixed, -32767, 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, 'wb') as out_w:
        out_w.setnchannels(1)
        out_w.setsampwidth(2)
        out_w.setframerate(rate)
        out_w.writeframes(final_pcm.tobytes())

    audio_b64 = base64.b64encode(buf.getvalue()).decode('utf-8')
    return digits_str, audio_b64


import os
import subprocess
import hashlib
from flask import current_app

# /api.js has been completely removed in favor of official CDN delivery

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
        app_strict_mode = cache_entry.get('strict_mode', False)
        app_under_attack_mode = cache_entry.get('under_attack_mode', False)
    else:
        # Hit the database
        app = get_app_by_sitekey(site_key)
        if not app:
            return jsonify({"success": False, "error": "Invalid sitekey"}), 400
            
        if getattr(app, 'is_test', False) and getattr(app, 'test_type', None) == 'error':
            return jsonify({"success": False, "error": "Service temporarily unavailable"}), 503
            
        app_theme = app.theme or 'auto'
        app_mode = app.mode or 'manual'
        app_domains = app.domains
        app_is_test = getattr(app, 'is_test', False)
        app_strict_mode = getattr(app, 'strict_mode', False)
        app_under_attack_mode = getattr(app, 'under_attack_mode', False)
        
        # Save to cache
        settings_cache[site_key] = {
            'theme': app_theme,
            'mode': app_mode,
            'domains': app_domains,
            'is_test': app_is_test,
            'strict_mode': app_strict_mode,
            'under_attack_mode': app_under_attack_mode,
            'timestamp': now
        }
        
    if not is_domain_authorized(app_domains, request):
        return jsonify({"success": False, "error": "Domain not authorized"}), 403

    client_ip = get_client_ip()
    vpn_detected = check_ip_vpn(client_ip)

    # Calculate dynamic PoW difficulty:
    # Level 4: Standard clean clients ("0000" prefix, instant verification)
    # Level 5: Elevated suspicion (VPN/Datacenter IP or strict_mode) ("00000" prefix, ~1-3s)
    # Level 6: Under attack mode ("000000" prefix, high friction against bot swarms)
    if app_is_test:
        pow_difficulty = 4
    elif app_under_attack_mode:
        pow_difficulty = 6
    elif vpn_detected or app_strict_mode:
        pow_difficulty = 5
    else:
        pow_difficulty = 4
        
    response = jsonify({
        "success": True,
        "theme": app_theme,
        "mode": app_mode,
        "is_test": app_is_test,
        "pow_difficulty": pow_difficulty,
        "pow_prefix": "0" * pow_difficulty
    })
    # Tell browser not to cache across different client IPs/reputations
    response.headers['Cache-Control'] = 'private, no-cache, no-store, must-revalidate'
    return response

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
    import json
    try:
        if telemetry is None:
            telemetry = {}
        log_entry = CaptchaLog.query.filter_by(site_key=site_key).first()
        if not log_entry:
            log_entry = CaptchaLog(site_key=site_key)
            log_entry.risk_score = 0.0
            log_entry.time_on_page = 0
            log_entry.mouse_score = 0
            log_entry.hardware_concurrency = 0
            log_entry.device_memory = 0
            log_entry.website_url = "[]"
            db.session.add(log_entry)
            
        log_entry.timestamp = datetime.utcnow()
        log_entry.status = status
        log_entry.client_ip = client_ip
        
        # Accumulate totals
        log_entry.hardware_concurrency = (log_entry.hardware_concurrency or 0) + 1
        log_entry.risk_score = (log_entry.risk_score or 0.0) + float(f"{risk_score:.2f}")
        log_entry.mouse_score = (log_entry.mouse_score or 0) + telemetry.get('mouseScore', 0)
        log_entry.time_on_page = (log_entry.time_on_page or 0) + telemetry.get('timeOnPage', 0)
        
        if vpn_detected:
            log_entry.device_memory = (log_entry.device_memory or 0) + 1
            
        # Update recent logs array
        try:
            recent_logs = json.loads(log_entry.website_url) if log_entry.website_url else []
        except Exception:
            recent_logs = []
            
        if client_ip and '.' in client_ip:
            masked_ip = f"{client_ip.split('.')[0]}.***.***"
        elif client_ip and ':' in client_ip:
            masked_ip = f"{client_ip.split(':')[0]}:***"
        else:
            masked_ip = client_ip or "***"

        new_log = {
            "success": status == "PASS",
            "risk_score": float(f"{risk_score:.2f}"),
            "ip_address": masked_ip,
            "timestamp": datetime.utcnow().isoformat()
        }
        recent_logs.insert(0, new_log)
        recent_logs = recent_logs[:10]
        log_entry.website_url = json.dumps(recent_logs)
        
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
    client_ip = get_client_ip()
    vpn_detected = check_ip_vpn(client_ip)

    risk_score = 0.0

    # VPN & Datacenter IP Detection
    if vpn_detected:
        risk_score += 0.3
            
    if getattr(app, 'block_vpns', False) and vpn_detected:
        upsert_captcha_log(site_key, "FAIL", risk_score, client_ip, vpn_detected, telemetry)
        return jsonify({"success": False, "error": "VPNs and Proxies are blocked by this application."}), 403

    # Modern Headless & Stealth Framework Detection
    if telemetry.get('webdriver'):
        risk_score += 1.0

    if telemetry.get('stealthDetected'):
        risk_score += 1.0

    if telemetry.get('cdcFound'):
        risk_score += 1.0

    if telemetry.get('automationGlobalsFound'):
        risk_score += 1.0

    if telemetry.get('outerDimensionsZero'):
        risk_score += 0.8

    if telemetry.get('pluginsFaked'):
        risk_score += 0.5

    if telemetry.get('chromeMissing'):
        risk_score += 0.5

    if telemetry.get('screenAnomalies'):
        risk_score += 0.4
        
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

    # Dynamic Proof of Work validation
    pow_data = telemetry.get('pow', {})
    if not pow_data:
        risk_score += 1.0 # No PoW provided
    else:
        nonce = pow_data.get('nonce')
        timestamp_pow = pow_data.get('timestamp')
        hash_hex = pow_data.get('hashHex')
        submitted_difficulty = pow_data.get('difficulty', 4)

        # Calculate expected minimum difficulty for this request:
        if getattr(app, 'is_test', False):
            expected_difficulty = 4
        elif getattr(app, 'under_attack_mode', False):
            expected_difficulty = 6
        elif vpn_detected or getattr(app, 'strict_mode', False):
            expected_difficulty = 5
        else:
            expected_difficulty = 4
        
        if nonce is None or not timestamp_pow or not hash_hex:
            risk_score += 1.0
        else:
            now_ms = time.time() * 1000
            if (now_ms - timestamp_pow > 300000) or (timestamp_pow - now_ms > 60000): # 5 minutes old or 1 min in future
                risk_score += 1.0
            else:
                msg = f"{site_key}{timestamp_pow}{nonce}".encode('utf-8')
                expected_hash = hashlib.sha256(msg).hexdigest()
                
                # Check valid hash calculation
                if expected_hash != hash_hex:
                    risk_score += 1.0
                
                # Check submitted difficulty prefix
                expected_prefix = "0" * int(submitted_difficulty)
                if not hash_hex.startswith(expected_prefix):
                    risk_score += 1.0
                
                # Check against expected difficulty (downgrade penalty)
                if submitted_difficulty < expected_difficulty:
                    risk_score += 0.6

    # Check if Visual Challenge is required
    requires_visual = False
    
    if getattr(app, 'is_test', False):
        if app.test_type == 'pass':
            risk_score = 0.0
            requires_visual = False
        elif app.test_type == 'fail':
            risk_score = 1.0
        elif app.test_type == 'slider':
            risk_score = 0.45
            requires_visual = True
        elif app.test_type == 'rotation':
            risk_score = 0.65
            requires_visual = True
        elif app.test_type == 'audio':
            risk_score = 0.75
            requires_visual = True
        elif app.test_type == 'error':
            return jsonify({"success": False, "error": "Service temporarily unavailable"}), 503
        # 'auto' continues normally
        
    risk_score = min(1.0, risk_score)
    if risk_score >= 0.85 or telemetry.get('honeypot'):
        from datetime import datetime
        stealth_str = f" | Stealth: {','.join(telemetry.get('stealthReasons', []))}" if telemetry.get('stealthReasons') else ""
        pow_str = f" | PoW: diff={pow_data.get('difficulty', 4)}" if pow_data else " | PoW: None"
        stats = f"IP: {client_ip} | VPN: {'Yes' if vpn_detected else 'No'}{pow_str} | TimeOnPage: {telemetry.get('timeOnPage', 'N/A')}ms | MouseScore: {telemetry.get('mouseScore', 'N/A')} | HW: {telemetry.get('hardwareConcurrency', 'N/A')}C/{telemetry.get('deviceMemory', 'N/A')}GB{stealth_str}"
        if current_app.debug:
            print(f"[CAPTCHA] Challenge Validation [FAIL] (Risk: {risk_score:.2f}) | Time: {datetime.utcnow().isoformat()}Z | Website: {telemetry.get('url', 'Unknown')} | {stats}")
        upsert_captcha_log(site_key, "FAIL", risk_score, client_ip, vpn_detected, telemetry)
            
        return jsonify({"success": False, "error": "Security validation failed. High risk detected."}), 403

    if getattr(app, 'under_attack_mode', False) or app.strict_mode or risk_score >= 0.35:
        requires_visual = True
    
    if requires_visual:
        # Determine challenge type based on client suspicion level:
        # - Low suspicion (risk < 0.35): Seamless pass
        # - Mild suspicion (0.35 <= risk < 0.55): Interactive Slider challenge (with accessibility audio option)
        # - Moderate suspicion (0.55 <= risk < 0.70): Image Rotation challenge (with accessibility audio option)
        # - High suspicion (0.70 <= risk < 0.85) or under_attack_mode: Mandatory Audio-Only challenge (for sus clients)
        # - Extreme suspicion (risk >= 0.85): Immediate block (403)
        forced_challenge = telemetry.get('forceChallenge')
        if getattr(app, 'is_test', False) and app.test_type in ['slider', 'rotation', 'audio']:
            challenge_type = app.test_type
        elif forced_challenge in ['slider', 'rotation', 'audio']:
            challenge_type = forced_challenge
        elif telemetry.get('audio'):
            challenge_type = 'audio'
        elif getattr(app, 'under_attack_mode', False) or risk_score >= 0.70:
            challenge_type = 'audio'
        elif risk_score >= 0.55:
            challenge_type = 'rotation'
        else:
            challenge_type = 'slider'

        timestamp = str(int(time.time()))
        challenge_string = secrets.token_hex(8)

        if challenge_type == 'audio':
            digits_str, audio_b64 = generate_audio_challenge()
            payload = f"aud:{challenge_string}:{digits_str}:{timestamp}"
            vis_sig = hmac.new(app.secret_key.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).hexdigest()
            visual_ticket = f"{payload}.{vis_sig}"
            upsert_captcha_log(site_key, "CHALLENGE", risk_score, client_ip, vpn_detected, telemetry)
            
            return jsonify({
                "success": False,
                "requires_visual": True,
                "visual_type": "audio",
                "audio_only": True,
                "audio": audio_b64,
                "visual_ticket": visual_ticket,
                "risk_score": risk_score
            })
        elif challenge_type == 'rotation':
            img_b64, target_angle = generate_rotation_challenge()
            payload = f"rot:{challenge_string}:{target_angle}:{timestamp}"
            vis_sig = hmac.new(app.secret_key.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).hexdigest()
            visual_ticket = f"{payload}.{vis_sig}"
            upsert_captcha_log(site_key, "CHALLENGE", risk_score, client_ip, vpn_detected, telemetry)
            
            return jsonify({
                "success": False,
                "requires_visual": True,
                "visual_type": "rotation",
                "image": img_b64,
                "visual_ticket": visual_ticket,
                "risk_score": risk_score
            })
        else:
            bg_b64, piece_b64, target_x, target_y = generate_slider_challenge()
            payload = f"sli:{challenge_string}:{target_x}:{timestamp}"
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
    pow_str = f" | PoW: diff={pow_data.get('difficulty', 4)}" if pow_data else " | PoW: None"
    stats = f"IP: {client_ip} | VPN: {'Yes' if vpn_detected else 'No'}{pow_str} | TimeOnPage: {telemetry.get('timeOnPage', 'N/A')}ms | MouseScore: {telemetry.get('mouseScore', 'N/A')} | HW: {telemetry.get('hardwareConcurrency', 'N/A')}C/{telemetry.get('deviceMemory', 'N/A')}GB"
    if current_app.debug:
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
            if current_app.debug:
                print(f"[CAPTCHA DEBUG] Token expired. Server time: {time.time()}, Token time: {timestamp}, Diff: {time.time() - timestamp}")
            return jsonify({
                "success": False,
                "error-codes": ["timeout-or-duplicate"]
            }), 400
        
        message = f"{app.site_key}:{timestamp_str}:{risk_score}".encode('utf-8')
        expected_signature = hmac.new(app.secret_key.encode('utf-8'), message, hashlib.sha256).hexdigest()
        
        if not hmac.compare_digest(signature, expected_signature):
            raise ValueError("Invalid signature")
            
        from models import ConsumedCaptchaToken
        from datetime import datetime, timedelta
        
        if ConsumedCaptchaToken.query.filter_by(signature=signature).first():
            if current_app.debug:
                print(f"[CAPTCHA DEBUG] Token signature {signature} was already found in ConsumedCaptchaToken table!")
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
            
        if current_app.debug:
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
            
        if current_app.debug:
            print(f"[CAPTCHA] Siteverify Validation [FAIL] (Reason: {str(e)})")
            
        return jsonify({
            "success": False,
            "error-codes": ["invalid-input-response"]
        }), 400

@captcha_bp.route('/audio-challenge', methods=['POST', 'OPTIONS'])
@limiter.limit("30 per minute")
def audio_challenge():
    """Generates an on-demand audio challenge for accessibility across all challenge types."""
    if request.method == 'OPTIONS':
        return '', 204
    data = request.get_json() or {}
    site_key = data.get('sitekey')
    if not site_key:
        return jsonify({"success": False, "error": "Missing sitekey"}), 400
    app = get_app_by_sitekey(site_key)
    if not app:
        return jsonify({"success": False, "error": "Invalid sitekey"}), 400
    if not is_domain_authorized(app.domains, request):
        return jsonify({"success": False, "error": "Domain not authorized"}), 403

    try:
        digits_str, audio_b64 = generate_audio_challenge()
        timestamp = str(int(time.time()))
        challenge_string = secrets.token_hex(8)
        payload = f"aud:{challenge_string}:{digits_str}:{timestamp}"
        vis_sig = hmac.new(app.secret_key.encode('utf-8'), payload.encode('utf-8'), hashlib.sha256).hexdigest()
        visual_ticket = f"{payload}.{vis_sig}"

        client_ip = get_client_ip()
        try:
            upsert_captcha_log(site_key, "CHALLENGE", 0.5, client_ip, check_ip_vpn(client_ip))
        except Exception as log_err:
            import logging
            logging.warning(f"[CAPTCHA] Log upsert error: {log_err}")

        return jsonify({
            "success": False,
            "requires_visual": True,
            "visual_type": "audio",
            "audio_only": False,
            "audio": audio_b64,
            "visual_ticket": visual_ticket,
            "risk_score": 0.5
        })
    except Exception as e:
        import logging
        logging.error(f"[CAPTCHA] Audio challenge generation error: {e}")
        return jsonify({"success": False, "error": "Failed to generate audio challenge"}), 500

@captcha_bp.route('/visual-verify', methods=['POST', 'OPTIONS'])
@limiter.limit("20 per minute")
def visual_verify():
    """Validates the Visual/Audio Challenge and issues the token if valid."""
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
        
    try:
        payload_body, vis_sig = visual_ticket.rsplit('.', 1)
        expected_sig = hmac.new(app.secret_key.encode('utf-8'), payload_body.encode('utf-8'), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(vis_sig, expected_sig):
            raise ValueError("Invalid signature")
            
        from models import ConsumedCaptchaToken
        from datetime import datetime, timedelta
        
        if ConsumedCaptchaToken.query.filter_by(signature=vis_sig).first():
            raise ValueError("Ticket already used")
            
        parts = payload_body.split(':')
        
        if len(parts) >= 4 and parts[0] in ['rot', 'sli', 'aud']:
            c_type = parts[0]
            challenge_string = parts[1]
            expected_ans = parts[2]
            timestamp = int(parts[3])
        elif len(parts) == 3:
            c_type = 'sli'
            challenge_string = parts[0]
            expected_ans = parts[1]
            timestamp = int(parts[2])
        else:
            c_type = 'sli'
            challenge_string = parts[0]
            expected_ans = parts[1]
            timestamp = int(time.time())
            
        if time.time() - timestamp > 300:
            raise ValueError("Ticket expired")
            
        expires = datetime.utcfromtimestamp(timestamp) + timedelta(seconds=300)
        db.session.add(ConsumedCaptchaToken(signature=vis_sig, expires_at=expires))
            
    except Exception as ex:
        app.total_failures = (app.total_failures or 0) + 1
        if not getattr(app, 'is_test', False):
            db.session.add(app)
        client_ip = get_client_ip()
        upsert_captcha_log(site_key, "FAIL", 1.0, client_ip, check_ip_vpn(client_ip))
        return jsonify({"success": False, "error": "Invalid ticket"}), 400
        
    # Validation logic based on challenge type
    is_valid = False
    try:
        if c_type == 'rot':
            submitted_angle = float(answer)
            expected_rot = float(expected_ans)
            deviation = (expected_rot + submitted_angle) % 360
            if deviation > 180:
                deviation = 360 - deviation
            # Tolerance within 12 degrees
            is_valid = abs(deviation) <= 12.0
        elif c_type == 'aud':
            clean_sub = ''.join(c for c in str(answer) if c.isdigit())
            clean_exp = ''.join(c for c in str(expected_ans) if c.isdigit())
            is_valid = (clean_sub == clean_exp) and len(clean_exp) >= 3
        else:
            submitted_x = float(answer)
            expected_x = float(expected_ans)
            # Tolerance of +/- 5 pixels
            is_valid = abs(submitted_x - expected_x) <= 5.0
    except (ValueError, TypeError):
        is_valid = False
        
    if not is_valid:
        app.total_failures = (app.total_failures or 0) + 1
        if not getattr(app, 'is_test', False):
            db.session.add(app)
        client_ip = get_client_ip()
        upsert_captcha_log(site_key, "FAIL", 1.0, client_ip, check_ip_vpn(client_ip))
        return jsonify({"success": False, "error": "Incorrect answer"}), 400
        
    risk_score = 0.35
    timestamp = str(int(time.time()))
    message = f"{site_key}:{timestamp}:{risk_score}".encode('utf-8')
    signature = hmac.new(app.secret_key.encode('utf-8'), message, hashlib.sha256).hexdigest()
    
    token = f"{site_key}~{timestamp}~{risk_score}.{signature}"
    client_ip = get_client_ip()
    upsert_captcha_log(site_key, "PASS", risk_score, client_ip, check_ip_vpn(client_ip))
    
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
    import json
    
    stats = CaptchaLog.query.filter_by(site_key=site_key).first()
    
    total_logs = stats.hardware_concurrency if stats and stats.hardware_concurrency else 0
    
    if total_logs == 0:
        return jsonify({
            "success": True, 
            "global_stats": {
                "total_challenges": app_data.total_challenges or 0,
                "total_successes": app_data.total_successes or 0,
                "total_failures": app_data.total_failures or 0,
                "average_risk_score": 0.0
            },
            "recent_stats": {
                "analyzed_logs": 0,
                "average_mouse_score": 0,
                "average_time_on_page_ms": 0,
                "vpn_detected_count": 0
            }, 
            "recent_logs": []
        })
        
    avg_risk = (stats.risk_score or 0.0) / total_logs
    avg_mouse = (stats.mouse_score or 0) / total_logs
    avg_time = (stats.time_on_page or 0) / total_logs
    vpn_count = stats.device_memory or 0
    
    try:
        recent_logs = json.loads(stats.website_url) if stats and stats.website_url else []
    except Exception:
        recent_logs = []
    
    global_stats = {
        "total_challenges": app_data.total_challenges or 0,
        "total_successes": app_data.total_successes or 0,
        "total_failures": app_data.total_failures or 0,
        "average_risk_score": round(avg_risk, 2)
    }
    
    recent_stats = {
        "analyzed_logs": total_logs,
        "average_mouse_score": round(avg_mouse, 1),
        "average_time_on_page_ms": round(avg_time, 0),
        "vpn_detected_count": vpn_count
    }
    
    return jsonify({
        "success": True,
        "global_stats": global_stats,
        "recent_stats": recent_stats,
        "recent_logs": recent_logs
    })
