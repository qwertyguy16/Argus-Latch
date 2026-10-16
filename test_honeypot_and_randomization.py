import json
import base64
import time
import hashlib
from app import app
from models import CaptchaLog

def test_honeypot_spike():
    print("=" * 60)
    print("TESTING HONEYPOT CAPTCHA BOX & SCORE SPIKE")
    print("=" * 60)

    client = app.test_client()
    site_key = "argus_3x000000000000000000000000"

    # Helper function to generate valid PoW
    def generate_pow(key, difficulty=4):
        now = int(time.time() * 1000)
        nonce = 0
        prefix = "0" * difficulty
        while True:
            msg = f"{key}{now}{nonce}".encode('utf-8')
            h = hashlib.sha256(msg).hexdigest()
            if h.startswith(prefix):
                return {"nonce": nonce, "timestamp": now, "hashHex": h, "difficulty": difficulty}
            nonce += 1

    valid_pow = generate_pow(site_key, 4)

    # 1. Clean Telemetry without honeypot -> should PASS
    print("\n[Case 1] Clean client without honeypot interaction...")
    telemetry_clean = {
        "webdriver": False,
        "stealthDetected": False,
        "timeOnPage": 2500,
        "mouseScore": 0,
        "hardwareConcurrency": 8,
        "deviceMemory": 16,
        "canvasFingerprint": "mock_canvas_fingerprint_valid_len_32",
        "audioFingerprint": "12345.67",
        "webglRenderer": "Intel Iris Xe Graphics",
        "honeypot": False,
        "pow": valid_pow
    }

    res_clean = client.post('/v1/captcha/challenge', json={
        "sitekey": site_key,
        "telemetry": telemetry_clean
    })
    assert res_clean.status_code == 200, f"Expected 200, got {res_clean.status_code}: {res_clean.get_data(as_text=True)}"
    data_clean = res_clean.get_json()
    assert data_clean.get("success") is True
    print("  -> Clean request succeeded with token!")

    # 2. Telemetry with honeypot triggered -> must immediately spike risk score to 1.0 and return 403
    print("\n[Case 2] Bot clicked/interacted with fake honeypot captcha box...")
    telemetry_honeypot = {
        "webdriver": False,
        "stealthDetected": False,
        "timeOnPage": 2500,
        "mouseScore": 0,
        "hardwareConcurrency": 8,
        "deviceMemory": 16,
        "canvasFingerprint": "mock_canvas_fingerprint_valid_len_32",
        "audioFingerprint": "12345.67",
        "webglRenderer": "Intel Iris Xe Graphics",
        "honeypot": True,
        "honeypotTriggered": True,
        "honeypotAction": "click",
        "pow": valid_pow
    }

    res_honey = client.post('/v1/captcha/challenge', json={
        "sitekey": site_key,
        "telemetry": telemetry_honeypot
    })
    assert res_honey.status_code == 403, f"Expected 403, got {res_honey.status_code}: {res_honey.get_data(as_text=True)}"
    data_honey = res_honey.get_json()
    assert data_honey.get("success") is False
    assert "High risk detected" in data_honey.get("error", "")
    print("  -> Honeypot interaction was caught and immediately blocked with 403!")

    # Check database log
    with app.app_context():
        log = CaptchaLog.query.filter_by(site_key=site_key).first()
        assert log is not None
        assert log.status == "FAIL"
        recent = json.loads(log.website_url)
        assert len(recent) > 0
        assert recent[0]['risk_score'] == 1.0, f"Expected latest risk_score 1.0, got {recent[0]['risk_score']}"
        print(f"  -> CaptchaLog verified: status={log.status}, latest_risk={recent[0]['risk_score']} (Spiked to 1.0)")

    # 3. Telemetry with honeypotTriggered flag
    print("\n[Case 3] Bot touched honeypot input...")
    telemetry_touched = {
        "webdriver": False,
        "timeOnPage": 2500,
        "pow": valid_pow,
        "honeypotTriggered": True,
        "honeypotAction": "focus"
    }
    res_touched = client.post('/v1/captcha/challenge', json={
        "sitekey": site_key,
        "telemetry": telemetry_touched
    })
    assert res_touched.status_code == 403
    print("  -> Honeypot touch / focus was blocked with 403!")

    # 4. Check JS template for randomization & honeypot box
    print("\n[Case 4] Verifying captcha_api.js contains honeypot trap & element randomization...")
    with open('templates/api/captcha_api.js', 'r', encoding='utf-8') as f:
        js = f.read()

    assert 'recaptcha-checkbox' in js, "Missing recaptcha-checkbox class in honeypot"
    assert 'recaptcha-anchor' in js, "Missing recaptcha-anchor ID in honeypot"
    assert 'g-recaptcha-response' in js, "Missing g-recaptcha-response input in honeypot"
    assert 'cf-turnstile-wrapper' in js, "Missing cf-turnstile-wrapper in honeypot"
    assert 'randUid' in js, "Missing randUid randomization"
    assert 'randSalt' in js, "Missing randSalt randomization"
    assert 'randDataAttr' in js, "Missing randDataAttr randomization"
    print("  -> captcha_api.js has fake honeypot box with obvious bot selectors and dynamic element randomization!")

    print("\n" + "=" * 60)
    print("ALL HONEYPOT & RANDOMIZATION TESTS PASSED!")
    print("=" * 60)

if __name__ == '__main__':
    test_honeypot_spike()
