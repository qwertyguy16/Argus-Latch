import re

file_path = r'c:\Users\lucad\Downloads\Argus-Latch\routes\v1\captcha.py'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Add the helper function right after check_ip_vpn
helper = """
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

"""
if 'def upsert_captcha_log' not in content:
    content = content.replace('def challenge():', helper + '@captcha_bp.route(\'/challenge\', methods=[\'POST\', \'OPTIONS\'])\n@limiter.limit("20 per minute")\ndef challenge():')

# Replace block 1: VPN fail
regex1 = r'''\s*try:\s*from models import CaptchaLog\s*log_entry = CaptchaLog\(\s*site_key=site_key,\s*timestamp=datetime\.utcnow\(\),\s*status='FAIL',\s*risk_score=float\(f"\{risk_score:\.2f\}"\),\s*client_ip=client_ip,\s*vpn_detected=vpn_detected,\s*time_on_page=telemetry\.get\('timeOnPage'\),\s*mouse_score=telemetry\.get\('mouseScore'\),\s*hardware_concurrency=telemetry\.get\('hardwareConcurrency'\),\s*device_memory=telemetry\.get\('deviceMemory'\),\s*website_url=telemetry\.get\('url', 'Unknown'\)\s*\)\s*db\.session\.add\(log_entry\)\s*db\.session\.commit\(\)\s*except Exception as e:\s*import logging\s*logging\.error\(f"Failed to commit captcha vpn fail log: \{e\}"\)\s*db\.session\.rollback\(\)'''

content = re.sub(regex1, '\n        upsert_captcha_log(site_key, "FAIL", risk_score, client_ip, vpn_detected, telemetry)', content)

# Replace block 2: challenge fail (high risk)
regex2 = r'''\s*try:\s*from models import CaptchaLog\s*log_entry = CaptchaLog\(\s*site_key=site_key,\s*timestamp=datetime\.utcnow\(\),\s*status='FAIL',\s*risk_score=float\(f"\{risk_score:\.2f\}"\),\s*client_ip=client_ip,\s*vpn_detected=vpn_detected,\s*time_on_page=telemetry\.get\('timeOnPage'\),\s*mouse_score=telemetry\.get\('mouseScore'\),\s*hardware_concurrency=telemetry\.get\('hardwareConcurrency'\),\s*device_memory=telemetry\.get\('deviceMemory'\),\s*website_url=telemetry\.get\('url', 'Unknown'\)\s*\)\s*db\.session\.add\(log_entry\)\s*db\.session\.commit\(\)\s*except Exception as e:\s*import logging\s*logging\.error\(f"Failed to commit captcha fail log: \{e\}"\)\s*db\.session\.rollback\(\)'''

content = re.sub(regex2, '\n        upsert_captcha_log(site_key, "FAIL", risk_score, client_ip, vpn_detected, telemetry)', content)


# Replace block 3: challenge req visual
regex3 = r'''\s*try:\s*from models import CaptchaLog\s*log_entry = CaptchaLog\(\s*site_key=site_key,\s*timestamp=datetime\.utcnow\(\),\s*status='CHALLENGE',\s*risk_score=float\(f"\{risk_score:\.2f\}"\),\s*client_ip=client_ip,\s*vpn_detected=vpn_detected,\s*time_on_page=telemetry\.get\('timeOnPage'\),\s*mouse_score=telemetry\.get\('mouseScore'\),\s*hardware_concurrency=telemetry\.get\('hardwareConcurrency'\),\s*device_memory=telemetry\.get\('deviceMemory'\),\s*website_url=telemetry\.get\('url', 'Unknown'\)\s*\)\s*db\.session\.add\(log_entry\)\s*db\.session\.commit\(\)\s*except Exception as e:\s*import logging\s*logging\.error\(f"Failed to commit captcha challenge log: \{e\}"\)\s*db\.session\.rollback\(\)'''

content = re.sub(regex3, '\n        upsert_captcha_log(site_key, "CHALLENGE", risk_score, client_ip, vpn_detected, telemetry)', content)

# Replace block 4: pass
regex4 = r'''\s*try:\s*from models import CaptchaLog\s*log_entry = CaptchaLog\(\s*site_key=site_key,\s*timestamp=datetime\.utcnow\(\),\s*status='PASS',\s*risk_score=float\(f"\{risk_score:\.2f\}"\),\s*client_ip=client_ip,\s*vpn_detected=vpn_detected,\s*time_on_page=telemetry\.get\('timeOnPage'\),\s*mouse_score=telemetry\.get\('mouseScore'\),\s*hardware_concurrency=telemetry\.get\('hardwareConcurrency'\),\s*device_memory=telemetry\.get\('deviceMemory'\),\s*website_url=telemetry\.get\('url', 'Unknown'\)\s*\)\s*db\.session\.add\(log_entry\)\s*db\.session\.commit\(\)\s*except Exception as e:\s*import logging\s*logging\.error\(f"Failed to commit captcha pass log: \{e\}"\)\s*db\.session\.rollback\(\)'''

content = re.sub(regex4, '\n    upsert_captcha_log(site_key, "PASS", risk_score, client_ip, vpn_detected, telemetry)', content)


# visual_verify FAIL 1
regex5 = r'''\s*try:\s*from models import CaptchaLog\s*client_ip = request\.headers\.get\('X-Forwarded-For', request\.remote_addr\)\s*log_entry = CaptchaLog\(\s*site_key=site_key,\s*timestamp=datetime\.utcnow\(\),\s*status='FAIL',\s*risk_score=1\.0,\s*client_ip=client_ip,\s*vpn_detected=check_ip_vpn\(client_ip\),\s*website_url='Unknown'\s*\)\s*db\.session\.add\(log_entry\)\s*db\.session\.commit\(\)\s*except Exception as e:\s*import logging\s*logging\.error\(f"Failed to commit visual ticket failure: \{e\}"\)\s*db\.session\.rollback\(\)'''

content = re.sub(regex5, '\n        upsert_captcha_log(site_key, "FAIL", 1.0, request.headers.get("X-Forwarded-For", request.remote_addr), check_ip_vpn(request.headers.get("X-Forwarded-For", request.remote_addr)))', content)


# visual_verify FAIL 2
regex6 = r'''\s*try:\s*from models import CaptchaLog\s*client_ip = request\.headers\.get\('X-Forwarded-For', request\.remote_addr\)\s*log_entry = CaptchaLog\(\s*site_key=site_key,\s*timestamp=datetime\.utcnow\(\),\s*status='FAIL',\s*risk_score=1\.0,\s*client_ip=client_ip,\s*vpn_detected=check_ip_vpn\(client_ip\),\s*website_url='Unknown'\s*\)\s*db\.session\.add\(log_entry\)\s*db\.session\.commit\(\)\s*except Exception as e:\s*import logging\s*logging\.error\(f"Failed to commit visual incorrect answer: \{e\}"\)\s*db\.session\.rollback\(\)'''

content = re.sub(regex6, '\n        upsert_captcha_log(site_key, "FAIL", 1.0, request.headers.get("X-Forwarded-For", request.remote_addr), check_ip_vpn(request.headers.get("X-Forwarded-For", request.remote_addr)))', content)

# visual_verify PASS
regex7 = r'''\s*try:\s*from models import CaptchaLog\s*client_ip = request\.headers\.get\('X-Forwarded-For', request\.remote_addr\)\s*log_entry = CaptchaLog\(\s*site_key=site_key,\s*timestamp=datetime\.utcnow\(\),\s*status='PASS',\s*risk_score=float\(f"\{risk_score:\.2f\}"\),\s*client_ip=client_ip,\s*vpn_detected=check_ip_vpn\(client_ip\),\s*website_url='Unknown'\s*\)\s*db\.session\.add\(log_entry\)\s*db\.session\.commit\(\)\s*except Exception as e:\s*import logging\s*logging\.error\(f"Failed to commit visual ticket success: \{e\}"\)\s*db\.session\.rollback\(\)'''

content = re.sub(regex7, '\n    upsert_captcha_log(site_key, "PASS", risk_score, request.headers.get("X-Forwarded-For", request.remote_addr), check_ip_vpn(request.headers.get("X-Forwarded-For", request.remote_addr)))', content)

# Also fix the routing decorators if the regex for challenge didn't match cleanly:
content = content.replace('@captcha_bp.route(\'/challenge\', methods=[\'POST\', \'OPTIONS\'])\n@limiter.limit("20 per minute")\n@captcha_bp.route(\'/challenge\', methods=[\'POST\', \'OPTIONS\'])\n@limiter.limit("20 per minute")\ndef challenge():', '@captcha_bp.route(\'/challenge\', methods=[\'POST\', \'OPTIONS\'])\n@limiter.limit("20 per minute")\ndef challenge():')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Patch applied")
