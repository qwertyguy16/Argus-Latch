import time
import math
import hmac
import hashlib
import json
import secrets
import base64
from app import app
from routes.v1.captcha import (
    encrypt_ticket,
    decrypt_ticket,
    is_pow_replayed,
    record_consumed_pow,
    get_app_by_sitekey,
    TEST_KEYS,
    MockTestApp
)
from models import ConsumedCaptchaToken, CaptchaApplication
from extensions import db

def test_crypto_ticket_integrity():
    print("=" * 60)
    print("TESTING PRODUCTION v3 AUTHENTICATED TICKET CRYPTOGRAPHY")
    print("=" * 60)
    
    secret = "sk_prod_super_secret_test_key_12345"
    c_type = "sli"
    challenge_str = secrets.token_hex(8)
    expected_ans = 142
    timestamp = str(int(time.time()))
    
    # 1. Encrypt ticket
    ticket = encrypt_ticket(secret, c_type, challenge_str, expected_ans, timestamp)
    assert ticket.startswith("v3."), f"Ticket should start with v3: {ticket}"
    assert str(expected_ans) not in ticket, "Solution leaked in ticket!"
    assert challenge_str not in ticket, "Challenge string leaked in ticket!"
    print(f"  -> Encrypted v3 ticket generated: {ticket[:40]}... (len: {len(ticket)})")
    print("  -> Confirmed: Solution and challenge parameters are completely opaque/ciphertext.")
    
    # 2. Decrypt with correct secret
    parts = decrypt_ticket(secret, ticket)
    assert parts is not None, "Decryption failed with correct secret"
    assert parts[0] == c_type
    assert parts[1] == challenge_str
    assert parts[2] == str(expected_ans)
    assert parts[3] == timestamp
    print("  -> Decryption with correct secret succeeded and recovered exact parameters.")
    
    # 3. Decrypt with wrong secret
    wrong_parts = decrypt_ticket("sk_wrong_secret_key", ticket)
    assert wrong_parts is None, "Decryption should have failed with wrong secret"
    print("  -> Decryption with wrong secret correctly rejected (None returned).")
    
    # 4. Tampered ciphertext or tag
    # Corrupt last character of base64
    tampered_ticket = ticket[:-1] + ('A' if ticket[-1] != 'A' else 'B')
    tampered_parts = decrypt_ticket(secret, tampered_ticket)
    assert tampered_parts is None, "Decryption should have failed with tampered tag/ciphertext"
    print("  -> Tampered ticket authentication check correctly rejected tampering.")

def test_production_pow_anti_replay():
    print("\n" + "=" * 60)
    print("TESTING PRODUCTION PoW SINGLE-USE ANTI-REPLAY DEFENSE")
    print("=" * 60)
    
    site_key = "argus_prod_test_sitekey_99999"
    now = int(time.time() * 1000)
    nonce = 0
    prefix = "0000"
    while True:
        msg = f"{site_key}{now}{nonce}".encode('utf-8')
        h = hashlib.sha256(msg).hexdigest()
        if h.startswith(prefix):
            break
        nonce += 1
        
    pow_data = {"nonce": nonce, "timestamp": now, "hashHex": h, "difficulty": 4}
    
    # Initial check: PoW not replayed
    assert not is_pow_replayed(h), "Initial PoW should not be flagged as replayed"
    print("  -> Initial PoW verified fresh: not replayed.")
    
    # Record consumed PoW
    record_consumed_pow(h)
    assert is_pow_replayed(h), "Consumed PoW must be flagged as replayed!"
    print("  -> Reused PoW was immediately flagged as replayed (Anti-Replay Active)!")

def test_production_visual_verify_flow():
    print("\n" + "=" * 60)
    print("TESTING END-TO-END PRODUCTION APP WITH v3 TICKET ON CLIENT")
    print("=" * 60)
    
    client = app.test_client()
    
    # Create or ensure a production test app exists in the test context
    with app.app_context():
        # Check if an existing prod app exists or use one from DB
        prod_app = CaptchaApplication.query.filter_by(site_key="argus_prod_audit_test_key").first()
        if not prod_app:
            prod_app = CaptchaApplication(
                name="Security Audit Prod App",
                site_key="argus_prod_audit_test_key",
                secret_key="sk_prod_audit_secret_key_987654321",
                domains="localhost,127.0.0.1",
                mode="manual",
                strict_mode=False
            )
            db.session.add(prod_app)
            db.session.commit()
            
    # Step 1: Request visual challenge using prod sitekey
    site_key = "argus_prod_audit_test_key"
    now = int(time.time() * 1000)
    nonce = 0
    prefix = "0000"
    while True:
        msg = f"{site_key}{now}{nonce}".encode('utf-8')
        h = hashlib.sha256(msg).hexdigest()
        if h.startswith(prefix):
            break
        nonce += 1
    pow_obj = {"nonce": nonce, "timestamp": now, "hashHex": h, "difficulty": 4}
    
    clean_telemetry = {
        "timeOnPage": 2500,
        "mouseScore": 10,
        "hardwareConcurrency": 8,
        "deviceMemory": 16,
        "webglRenderer": "Intel Iris Pro Graphics",
        "canvasFingerprint": "mock_canvas_fingerprint_hash_valid",
        "audioFingerprint": "mock_audio_fp_12345",
        "forceVisual": True,
        "forceChallenge": "slider",
        "pow": pow_obj
    }
    
    # Encrypt with v2 Salted S-box cipher
    v2_iv = "a1b2c3d4e5f60718"
    v2_seed = site_key + v2_iv
    v2_sbox = list(range(256))
    v2_j = 0
    for i in range(256):
        v2_j = (v2_j + v2_sbox[i] + ord(v2_seed[i % len(v2_seed)])) & 0xFF
        v2_sbox[i], v2_sbox[v2_j] = v2_sbox[v2_j], v2_sbox[i]
    v2_res_bytes = []
    v2_i1 = v2_j1 = 0
    v2_prev = 0xAA
    v2_json_str = json.dumps(clean_telemetry)
    for p in v2_json_str:
        v2_i1 = (v2_i1 + 1) & 0xFF
        v2_j1 = (v2_j1 + v2_sbox[v2_i1]) & 0xFF
        v2_sbox[v2_i1], v2_sbox[v2_j1] = v2_sbox[v2_j1], v2_sbox[v2_i1]
        kbyte = v2_sbox[(v2_sbox[v2_i1] + v2_sbox[v2_j1]) & 0xFF]
        cbyte = (ord(p) ^ kbyte ^ v2_prev) & 0xFF
        v2_prev = cbyte
        v2_res_bytes.append(cbyte)
    v2_payload = "v2:" + v2_iv + ":" + base64.b64encode(bytes(v2_res_bytes)).decode('utf-8')
    
    res = client.post('/v1/captcha/challenge', json={
        "sitekey": site_key,
        "telemetry": v2_payload
    }, headers={"Origin": "http://localhost"})
    
    # Real prod apps with forceVisual will trigger visual challenge
    assert res.status_code == 200, f"Expected 200, got {res.status_code} {res.get_data(as_text=True)}"
    data = res.get_json()
    assert data.get('requires_visual') is True, f"Prod app should require visual challenge: {data}"
    ticket = data.get('visual_ticket')
    assert ticket.startswith("v3."), f"Prod app visual ticket MUST be v3 authenticated encryption: {ticket}"
    print(f"  -> Successfully generated prod challenge with v3 ticket: {ticket[:45]}...")
    
    # Decrypt solution on server-side to simulate user solve
    parts = decrypt_ticket("sk_prod_audit_secret_key_987654321", ticket)
    assert parts is not None, "Failed to decrypt ticket for test validation"
    c_type, challenge_str, expected_ans, ts = parts
    print(f"  -> Challenge type: {c_type}, Expected answer: {expected_ans}")
    
    # Step 2: Test wrong answer rejection on v3 ticket 1
    wrong_ans = float(expected_ans) + 50.0
    bad_res = client.post('/v1/captcha/visual-verify', json={
        "sitekey": site_key,
        "visual_ticket": ticket,
        "answer": wrong_ans
    }, headers={"Origin": "http://localhost"})
    assert bad_res.status_code == 400, f"Expected 400 for incorrect answer: {bad_res.status_code}"
    assert bad_res.get_json().get("error") == "Incorrect answer"
    print("  -> Incorrect answer with v3 ticket properly rejected (400 'Incorrect answer').")
    
    # Step 3: Test that failed ticket cannot be retried/brute-forced
    retry_res = client.post('/v1/captcha/visual-verify', json={
        "sitekey": site_key,
        "visual_ticket": ticket,
        "answer": float(expected_ans)
    }, headers={"Origin": "http://localhost"})
    assert retry_res.status_code == 400
    print("  -> Brute-force protection verified: failed ticket was invalidated and cannot be retried.")

    # Step 4: Generate a fresh challenge & v3 ticket to solve
    now2 = int(time.time() * 1000)
    nonce2 = 0
    while True:
        msg = f"{site_key}{now2}{nonce2}".encode('utf-8')
        h2 = hashlib.sha256(msg).hexdigest()
        if h2.startswith("0000"):
            break
        nonce2 += 1
    clean_telemetry["pow"] = {"nonce": nonce2, "timestamp": now2, "hashHex": h2, "difficulty": 4}
    
    v2_iv2 = "b2c3d4e5f6071829"
    v2_seed2 = site_key + v2_iv2
    v2_sbox2 = list(range(256))
    v2_j2 = 0
    for i in range(256):
        v2_j2 = (v2_j2 + v2_sbox2[i] + ord(v2_seed2[i % len(v2_seed2)])) & 0xFF
        v2_sbox2[i], v2_sbox2[v2_j2] = v2_sbox2[v2_j2], v2_sbox2[i]
    v2_res_bytes2 = []
    v2_i2 = v2_j2 = 0
    v2_prev2 = 0xAA
    for p in json.dumps(clean_telemetry):
        v2_i2 = (v2_i2 + 1) & 0xFF
        v2_j2 = (v2_j2 + v2_sbox2[v2_i2]) & 0xFF
        v2_sbox2[v2_i2], v2_sbox2[v2_j2] = v2_sbox2[v2_j2], v2_sbox2[v2_i2]
        kbyte = v2_sbox2[(v2_sbox2[v2_i2] + v2_sbox2[v2_j2]) & 0xFF]
        cbyte = (ord(p) ^ kbyte ^ v2_prev2) & 0xFF
        v2_prev2 = cbyte
        v2_res_bytes2.append(cbyte)
    v2_payload2 = "v2:" + v2_iv2 + ":" + base64.b64encode(bytes(v2_res_bytes2)).decode('utf-8')
    
    res2 = client.post('/v1/captcha/challenge', json={
        "sitekey": site_key,
        "telemetry": v2_payload2
    }, headers={"Origin": "http://localhost"})
    assert res2.status_code == 200
    ticket2 = res2.get_json().get('visual_ticket')
    parts2 = decrypt_ticket("sk_prod_audit_secret_key_987654321", ticket2)
    expected_ans2 = parts2[2]

    # Step 5: Test valid answer submission on fresh v3 ticket
    good_res = client.post('/v1/captcha/visual-verify', json={
        "sitekey": site_key,
        "visual_ticket": ticket2,
        "answer": float(expected_ans2)
    }, headers={"Origin": "http://localhost"})
    assert good_res.status_code == 200, f"Expected 200 for correct answer: {good_res.status_code} {good_res.get_data(as_text=True)}"
    good_data = good_res.get_json()
    assert good_data.get('success') is True
    token = good_data.get('token')
    assert token, "Token missing in response"
    print(f"  -> Valid answer verified successfully! Token issued: {token[:40]}...")
    
    # Step 6: Test ticket replay rejection on solved v3 ticket
    replay_res = client.post('/v1/captcha/visual-verify', json={
        "sitekey": site_key,
        "visual_ticket": ticket2,
        "answer": float(expected_ans2)
    }, headers={"Origin": "http://localhost"})
    assert replay_res.status_code == 400, f"Expected 400 on v3 ticket replay: {replay_res.status_code}"
    print("  -> Replay protection for v3 ticket verified (consumed ticket rejected).")
    
    # Step 5: Test siteverify with issued token
    sv_res = client.post('/v1/captcha/siteverify', data={
        "secret": "sk_prod_audit_secret_key_987654321",
        "response": token
    })
    assert sv_res.status_code == 200, f"siteverify failed: {sv_res.status_code} {sv_res.get_data(as_text=True)}"
    sv_data = sv_res.get_json()
    assert sv_data.get('success') is True
    print(f"  -> Backend /siteverify verified token successfully! Hostname: {sv_data.get('hostname')}")
    
    # Clean up test app from DB
    with app.app_context():
        try:
            prod_app = CaptchaApplication.query.filter_by(site_key="argus_prod_audit_test_key").first()
            if prod_app:
                db.session.delete(prod_app)
                db.session.commit()
        except Exception:
            db.session.rollback()
            
    print("\nALL PRODUCTION SECURITY & v3 TICKET TESTS PASSED!")

if __name__ == "__main__":
    test_crypto_ticket_integrity()
    test_production_pow_anti_replay()
    test_production_visual_verify_flow()
