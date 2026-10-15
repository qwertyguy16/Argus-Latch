import time
import hashlib
import json
import base64
from app import app
from routes.v1.captcha import TEST_KEYS

def run_tests():
    client = app.test_client()
    print("=" * 60)
    print("ARGUS LATCH: TESTING STEALTH DETECTION & DYNAMIC PoW")
    print("=" * 60)

    # -------------------------------------------------------------
    # 1. Test /v1/captcha/settings returns dynamic PoW difficulty
    # -------------------------------------------------------------
    print("\n[Test 1] Testing /v1/captcha/settings dynamic PoW response...")
    res = client.get('/v1/captcha/settings?sitekey=argus_1x000000000000000000000000')
    assert res.status_code == 200, f"Expected 200, got {res.status_code}"
    data = res.get_json()
    assert data.get('success') is True
    assert 'pow_difficulty' in data, f"Missing pow_difficulty: {data}"
    assert 'pow_prefix' in data, f"Missing pow_prefix: {data}"
    assert data['pow_difficulty'] == 4
    assert data['pow_prefix'] == "0000"
    assert res.headers.get('Cache-Control') == 'private, no-cache, no-store, must-revalidate'
    print(f"  -> Settings OK: difficulty={data['pow_difficulty']}, prefix={data['pow_prefix']}")

    # Helper function to generate valid PoW
    def generate_pow(site_key, difficulty=4):
        now = int(time.time() * 1000)
        nonce = 0
        prefix = "0" * difficulty
        while True:
            msg = f"{site_key}{now}{nonce}".encode('utf-8')
            h = hashlib.sha256(msg).hexdigest()
            if h.startswith(prefix):
                return {"nonce": nonce, "timestamp": now, "hashHex": h, "difficulty": difficulty}
            nonce += 1

    # -------------------------------------------------------------
    # 2. Test valid PoW verification (Clean client)
    # -------------------------------------------------------------
    print("\n[Test 2] Testing valid PoW with clean telemetry...")
    clean_sitekey = "argus_3x000000000000000000000000"
    valid_pow = generate_pow(clean_sitekey, 4)
    telemetry = {
        "webdriver": False,
        "stealthDetected": False,
        "timeOnPage": 2500,
        "mouseScore": 0,
        "hardwareConcurrency": 8,
        "deviceMemory": 16,
        "canvasFingerprint": "mock_canvas_fingerprint_valid_len_32",
        "audioFingerprint": "12345.67",
        "webglRenderer": "Intel Iris Xe Graphics",
        "pow": valid_pow
    }
    res = client.post('/v1/captcha/challenge', json={
        "sitekey": clean_sitekey,
        "telemetry": telemetry
    })
    assert res.status_code == 200, f"Challenge failed: {res.status_code} {res.text}"
    chal_data = res.get_json()
    assert chal_data.get('success') is True, f"Expected success: {chal_data}"
    assert 'token' in chal_data, f"Missing token: {chal_data}"
    print(f"  -> Clean telemetry PASS with token: {chal_data['token'][:25]}...")

    # -------------------------------------------------------------
    # 3. Test Invalid PoW detection
    # -------------------------------------------------------------
    print("\n[Test 3] Testing tampered/invalid PoW rejection...")
    bad_pow = generate_pow(clean_sitekey, 4)
    bad_pow['hashHex'] = "0000" + "f" * 60 # Invalid hash for nonce
    res = client.post('/v1/captcha/challenge', json={
        "sitekey": clean_sitekey,
        "telemetry": {**telemetry, "pow": bad_pow}
    })
    # Since risk_score += 1.0 from invalid PoW, it should either fail with 403 or require challenge
    assert res.status_code in [403, 200]
    data = res.get_json()
    if res.status_code == 403:
        assert data.get('success') is False
        print("  -> Invalid PoW successfully blocked with 403 High Risk.")
    else:
        assert data.get('requires_visual') is True
        print(f"  -> Invalid PoW penalized risk_score to {data.get('risk_score')}.")

    # -------------------------------------------------------------
    # 4. Test Modern Headless & Stealth Detection: Webdriver flag
    # -------------------------------------------------------------
    print("\n[Test 4] Testing webdriver flag detection...")
    res = client.post('/v1/captcha/challenge', json={
        "sitekey": clean_sitekey,
        "telemetry": {**telemetry, "webdriver": True}
    })
    assert res.status_code == 403, f"Expected 403 for webdriver, got {res.status_code}"
    print("  -> Webdriver flag immediately blocked with 403.")

    # -------------------------------------------------------------
    # 5. Test Modern Headless & Stealth Detection: stealthDetected & cdcFound
    # -------------------------------------------------------------
    print("\n[Test 5] Testing stealthDetected (Puppeteer-stealth / Playwright-stealth)...")
    res = client.post('/v1/captcha/challenge', json={
        "sitekey": clean_sitekey,
        "telemetry": {
            **telemetry,
            "webdriver": False,
            "stealthDetected": True,
            "stealthReasons": ["webdriver_own_property_redefined", "function_toString_tampered"]
        }
    })
    assert res.status_code == 403, f"Expected 403 for stealthDetected, got {res.status_code}"
    print("  -> Stealth framework tampering immediately blocked with 403.")

    print("\n[Test 6] Testing cdcFound (ChromeDriver / Undetected-Chromedriver)...")
    res = client.post('/v1/captcha/challenge', json={
        "sitekey": clean_sitekey,
        "telemetry": {
            **telemetry,
            "webdriver": False,
            "cdcFound": True,
            "stealthReasons": ["cdc_marker_found:cdc_adoQpoasnfa76pfcZLmcfl_Array"]
        }
    })
    assert res.status_code == 403, f"Expected 403 for cdcFound, got {res.status_code}"
    print("  -> ChromeDriver cdc_ marker immediately blocked with 403.")

    print("\n[Test 7] Testing automationGlobalsFound (Playwright/Puppeteer globals)...")
    res = client.post('/v1/captcha/challenge', json={
        "sitekey": clean_sitekey,
        "telemetry": {
            **telemetry,
            "webdriver": False,
            "automationGlobalsFound": True,
            "stealthReasons": ["automation_global:__playwright"]
        }
    })
    assert res.status_code == 403, f"Expected 403 for automationGlobalsFound, got {res.status_code}"
    print("  -> Playwright/Puppeteer globals immediately blocked with 403.")

    # -------------------------------------------------------------
    # 6. Test Headless outer dimensions zero
    # -------------------------------------------------------------
    print("\n[Test 8] Testing outerDimensionsZero (Headless browser geometry)...")
    res = client.post('/v1/captcha/challenge', json={
        "sitekey": clean_sitekey,
        "telemetry": {
            **telemetry,
            "webdriver": False,
            "outerDimensionsZero": True,
            "stealthReasons": ["outer_dimensions_zero"]
        }
    })
    data = res.get_json()
    assert res.status_code in [200, 403]
    if res.status_code == 200:
        assert data.get('requires_visual') is True
        assert data.get('risk_score', 0) >= 0.70
        print(f"  -> Headless outer dimensions penalized risk to {data.get('risk_score')} (triggered {data.get('visual_type')} challenge).")
    else:
        print("  -> Headless outer dimensions blocked with 403.")

    # -------------------------------------------------------------
    # 7. Test Regression: All Presets still function
    # -------------------------------------------------------------
    print("\n[Test 9] Regression Testing Test Keys...")
    for key, info in TEST_KEYS.items():
        res = client.post('/v1/captcha/challenge', json={
            "sitekey": key,
            "telemetry": {**telemetry, "pow": generate_pow(key, 4)}
        })
        t_type = info['type']
        if t_type == 'pass':
            assert res.status_code == 200 and res.get_json().get('success') is True
        elif t_type == 'fail':
            assert res.status_code == 403
        elif t_type == 'error':
            assert res.status_code == 503
        elif t_type in ['slider', 'rotation', 'audio']:
            assert res.status_code == 200
            assert res.get_json().get('requires_visual') is True
            assert res.get_json().get('visual_type') == t_type
        print(f"  -> Preset '{t_type}' ({key[:10]}...) verified OK.")

    print("\n" + "=" * 60)
    print("ALL TESTS PASSED SUCCESSFULLY!")
    print("=" * 60)

if __name__ == '__main__':
    run_tests()
