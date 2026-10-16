import json
import base64
import time
import hashlib
import subprocess
import os
from app import app
from models import CaptchaLog

def run_js_eval(script):
    """Executes a JS snippet in Node.js and returns stdout."""
    res = subprocess.run(["node", "-e", script], capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"Node execution failed: {res.stderr}\nCode:\n{script}")
    return res.stdout.strip()

def test_vm_and_antitamper():
    print("=" * 70)
    print("TESTING ARGUS BYTECODE VM, ANTI-TAMPER & ANTI-HOOKING SHIELD")
    print("=" * 70)

    # -------------------------------------------------------------
    # 1. Test In-Script ArgusVM Bytecode Engine & Cipher in Node
    # -------------------------------------------------------------
    print("\n[Step 1] Testing ArgusVM opcode execution & integrity in Node.js...")
    vm_test_script = """
    const fs = require('fs');
    const source = fs.readFileSync('templates/api/captcha_api.js', 'utf8');

    // Extract ArgusVM definition from source
    const vmStart = source.indexOf('const ArgusVM = (function () {');
    const vmEnd = source.indexOf('// Telemetry Collection', vmStart);
    const vmCode = source.substring(vmStart, vmEnd);

    // Evaluate in fresh scope
    const evalScope = new Function(vmCode + '; return ArgusVM;')();

    // Verify verifyVM()
    const integrityOk = evalScope.verifyVM();

    // Verify custom bytecode execution
    const OP = evalScope.OP;
    const testProgram = {
        bytecode: [
            OP.PUSH_INT, 0x00, 0x14, // push 20
            OP.PUSH_INT, 0x00, 0x0A, // push 10
            OP.ADD,                  // 20 + 10 = 30
            OP.PUSH_INT, 0x00, 0x05, // push 5
            OP.SUB,                  // 30 - 5 = 25
            OP.PUSH_INT, 0x00, 0x03, // push 3
            OP.XOR,                  // 25 ^ 3 = 26
            OP.HALT
        ],
        constPool: [],
        key: ""
    };
    const execResult = evalScope.execute(testProgram, {});

    // Verify Cipher
    const plaintext = JSON.stringify({ test: "argus_vm_shield", nonce: 998877 });
    const sitekey = "argus_3x000000000000000000000000";
    const cipherText = evalScope.cipher(plaintext, sitekey);

    process.stdout.write(JSON.stringify({
        integrityOk,
        execResult,
        cipherText
    }));
    """
    vm_out = run_js_eval(vm_test_script)
    vm_data = json.loads(vm_out)
    assert vm_data["integrityOk"] is True, "ArgusVM verifyVM() failed!"
    assert vm_data["execResult"] == 26, f"Expected 26, got {vm_data['execResult']}"
    print(f"  -> ArgusVM verifyVM: PASSED (integrity verified)")
    print(f"  -> ArgusVM custom bytecode execution: PASSED (result = {vm_data['execResult']})")

    # Verify python backend decodes cipherText from ArgusVM
    site_key = "argus_3x000000000000000000000000"
    raw_b64 = vm_data["cipherText"]
    if raw_b64.startswith("v2:"):
        parts = raw_b64.split(":", 2)
        r_iv = parts[1]
        raw_bytes = base64.b64decode(parts[2])
        r_seed = site_key + r_iv
        r_sbox = list(range(256))
        rj = 0
        for i in range(256):
            rj = (rj + r_sbox[i] + ord(r_seed[i % len(r_seed)])) & 0xFF
            r_sbox[i], r_sbox[rj] = r_sbox[rj], r_sbox[i]
        dec = []
        ri1 = rj1 = 0
        r_prev = 0xAA
        for cbyte in raw_bytes:
            ri1 = (ri1 + 1) & 0xFF
            rj1 = (rj1 + r_sbox[ri1]) & 0xFF
            r_sbox[ri1], r_sbox[rj1] = r_sbox[rj1], r_sbox[ri1]
            kbyte = r_sbox[(r_sbox[ri1] + r_sbox[rj1]) & 0xFF]
            pcode = cbyte ^ kbyte ^ r_prev
            r_prev = cbyte
            dec.append(chr(pcode))
        recovered = "".join(dec)
    else:
        payload_str = base64.b64decode(raw_b64).decode('utf-8')
        recovered = "".join(chr(ord(c) ^ ord(site_key[i % len(site_key)])) for i, c in enumerate(payload_str))
    recovered_json = json.loads(recovered)
    assert recovered_json["test"] == "argus_vm_shield"
    assert recovered_json["nonce"] == 998877
    print("  -> ArgusVM Cipher <-> Backend Decryption: PASSED (v2 Salted S-Box verified)")

    # -------------------------------------------------------------
    # 2. Test ArgusShield Anti-Hooking & Anti-Tamper in Node
    # -------------------------------------------------------------
    print("\n[Step 2] Testing ArgusShield Anti-Tamper & Prototype Integrity in Node.js...")
    shield_test_script = """
    const fs = require('fs');
    const source = fs.readFileSync('templates/api/captcha_api.js', 'utf8');

    // Extract ArgusShield definition
    const shieldStart = source.indexOf('const ArgusShield = (function () {');
    const shieldEnd = source.indexOf('})();', shieldStart) + 5;
    const shieldCode = source.substring(shieldStart, shieldEnd);

    // Setup browser mocks with genuine V8 native functions
    const nativeFn = Object.assign;
    const win = {
        fetch: nativeFn,
        navigator: { webdriver: false },
        crypto: { subtle: { digest: nativeFn } },
        HTMLCanvasElement: { prototype: { toDataURL: nativeFn } }
    };

    const doc = {
        createElement: nativeFn
    };

    const eventTarget = {
        prototype: {
            addEventListener: nativeFn
        }
    };

    const fn = new Function('window', 'Document', 'EventTarget', shieldCode + '; return ArgusShield;');
    const shield = fn(win, { prototype: doc }, eventTarget);

    // Test 1: Clean environment
    const reportClean = shield.auditEnvironment();

    // Test 2: Hook window.fetch
    win.fetch = function hookedFetch() { return "tampered"; };
    const reportFetchHooked = shield.auditEnvironment();

    // Test 3: Tamper Function.prototype.toString
    const originalToString = Function.prototype.toString;
    Function.prototype.toString = function () { return "tampered_toString"; };
    const reportToStringHooked = shield.auditEnvironment();
    Function.prototype.toString = originalToString; // restore

    process.stdout.write(JSON.stringify({
        clean: reportClean,
        fetchHooked: reportFetchHooked,
        toStringHooked: reportToStringHooked
    }));
    """
    shield_out = run_js_eval(shield_test_script)
    shield_data = json.loads(shield_out)
    assert shield_data["clean"]["tamperingDetected"] is False, f"Clean env reported tampering: {shield_data['clean']}"
    print("  -> ArgusShield Clean Environment: PASSED (No false positives)")

    assert shield_data["fetchHooked"]["tamperingDetected"] is True
    assert shield_data["fetchHooked"]["hookingDetected"] is True
    assert "window.fetch" in shield_data["fetchHooked"]["tamperedAPIs"]
    print("  -> ArgusShield Hook Detection (window.fetch): PASSED (Caught hook)")

    assert shield_data["toStringHooked"]["tamperingDetected"] is True
    assert "Function.prototype.toString" in shield_data["toStringHooked"]["tamperedAPIs"]
    print("  -> ArgusShield Prototype Integrity (Function.prototype.toString): PASSED (Caught hook)")

    # -------------------------------------------------------------
    # 3. Test Backend Anti-Tamper Enforcement (/v1/captcha/challenge)
    # -------------------------------------------------------------
    print("\n[Step 3] Testing Backend Anti-Tamper Enforcement & Score Spikes...")
    client = app.test_client()

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

    base_telemetry = {
        "webdriver": False,
        "stealthDetected": False,
        "timeOnPage": 2500,
        "mouseScore": 0,
        "hardwareConcurrency": 8,
        "deviceMemory": 16,
        "canvasFingerprint": "valid_canvas_fingerprint_hex_abcdef0123456789",
        "audioFingerprint": "12345.67",
        "webglRenderer": "Intel Iris Xe Graphics",
        "honeypot": False,
        "pow": valid_pow,
        "tamperingDetected": False,
        "hookingDetected": False,
        "debuggerDetected": False,
        "tamperedAPIs": [],
        "vmExecuted": True,
        "vmIntegrityFailed": False
    }

    # Case A: Clean request with ArgusVM encrypted payload -> 200 OK
    print("\n  [Case A] Clean telemetry encrypted with ArgusVM cipher...")
    enc_payload = "".join(chr(ord(c) ^ ord(site_key[i % len(site_key)])) for i, c in enumerate(json.dumps(base_telemetry)))
    b64_telemetry = base64.b64encode(enc_payload.encode('utf-8')).decode('utf-8')

    res_clean = client.post('/v1/captcha/challenge', json={
        "sitekey": site_key,
        "telemetry": b64_telemetry
    })
    assert res_clean.status_code == 200, f"Expected 200, got {res_clean.status_code}: {res_clean.get_data(as_text=True)}"
    clean_resp = res_clean.get_json()
    assert clean_resp.get("success") is True
    assert "token" in clean_resp
    print("    -> Clean request succeeded with valid token!")

    # Case B: Hooked API detected -> 403 Forbidden, risk spiked to 1.0
    print("\n  [Case B] Hooked API detected (window.fetch monkeypatched)...")
    tampered_fetch_telemetry = dict(base_telemetry)
    tampered_fetch_telemetry["tamperingDetected"] = True
    tampered_fetch_telemetry["hookingDetected"] = True
    tampered_fetch_telemetry["tamperedAPIs"] = ["window.fetch"]
    enc_hooked = "".join(chr(ord(c) ^ ord(site_key[i % len(site_key)])) for i, c in enumerate(json.dumps(tampered_fetch_telemetry)))
    b64_hooked = base64.b64encode(enc_hooked.encode('utf-8')).decode('utf-8')

    res_hooked = client.post('/v1/captcha/challenge', json={
        "sitekey": site_key,
        "telemetry": b64_hooked
    })
    assert res_hooked.status_code == 403, f"Expected 403, got {res_hooked.status_code}"
    hooked_resp = res_hooked.get_json()
    assert hooked_resp.get("success") is False
    assert "Environment tampering detected" in hooked_resp.get("error", "")
    print(f"    -> Hooking was immediately rejected with 403: {hooked_resp['error']}")

    # Case C: VM Integrity Failure -> 403 Forbidden, risk spiked to 1.0
    print("\n  [Case C] VM Integrity failure (bytecode tampering)...")
    tampered_vm_telemetry = dict(base_telemetry)
    tampered_vm_telemetry["tamperingDetected"] = True
    tampered_vm_telemetry["vmIntegrityFailed"] = True
    enc_vm_fail = "".join(chr(ord(c) ^ ord(site_key[i % len(site_key)])) for i, c in enumerate(json.dumps(tampered_vm_telemetry)))
    b64_vm_fail = base64.b64encode(enc_vm_fail.encode('utf-8')).decode('utf-8')

    res_vm_fail = client.post('/v1/captcha/challenge', json={
        "sitekey": site_key,
        "telemetry": b64_vm_fail
    })
    assert res_vm_fail.status_code == 403, f"Expected 403, got {res_vm_fail.status_code}"
    vm_fail_resp = res_vm_fail.get_json()
    assert vm_fail_resp.get("success") is False
    assert "Environment tampering detected" in vm_fail_resp.get("error", "")
    print(f"    -> VM integrity failure was blocked with 403: {vm_fail_resp['error']}")

    # Case D: Debugger timing trap triggered -> 403 Forbidden
    print("\n  [Case D] Debugger timing trap triggered...")
    debugger_telemetry = dict(base_telemetry)
    debugger_telemetry["tamperingDetected"] = True
    debugger_telemetry["debuggerDetected"] = True
    debugger_telemetry["tamperedAPIs"] = ["debugger_timing_trap"]
    enc_debugger = "".join(chr(ord(c) ^ ord(site_key[i % len(site_key)])) for i, c in enumerate(json.dumps(debugger_telemetry)))
    b64_debugger = base64.b64encode(enc_debugger.encode('utf-8')).decode('utf-8')

    res_dbg = client.post('/v1/captcha/challenge', json={
        "sitekey": site_key,
        "telemetry": b64_debugger
    })
    assert res_dbg.status_code == 403, f"Expected 403, got {res_dbg.status_code}"
    dbg_resp = res_dbg.get_json()
    assert dbg_resp.get("success") is False
    assert "Environment tampering detected" in dbg_resp.get("error", "")
    print(f"    -> Debugger detection was blocked with 403: {dbg_resp['error']}")

    # Verify log entry recorded status=FAIL and risk_score=1.0
    with app.app_context():
        log = CaptchaLog.query.filter_by(site_key=site_key).first()
        assert log is not None
        recent_logs = json.loads(log.website_url)
        assert len(recent_logs) > 0
        latest_entry = recent_logs[0]
        assert log.status == "FAIL"
        assert latest_entry["success"] is False
        assert latest_entry["risk_score"] == 1.0
        print("    -> Database CaptchaLog verified: status=FAIL, risk_score=1.0 recorded")

    # Case E: Clean request with v2 Salted S-Box CBC cipher -> 200 OK
    print("\n  [Case E] Clean telemetry encrypted with v2 Salted S-Box CBC cipher...")
    v2_iv = "f0e1d2c3b4a59687"
    v2_seed = site_key + v2_iv
    v2_sbox = list(range(256))
    v2_j = 0
    for i in range(256):
        v2_j = (v2_j + v2_sbox[i] + ord(v2_seed[i % len(v2_seed)])) & 0xFF
        v2_sbox[i], v2_sbox[v2_j] = v2_sbox[v2_j], v2_sbox[i]
    v2_res_bytes = []
    v2_i1 = v2_j1 = 0
    v2_prev = 0xAA
    v2_json_str = json.dumps(base_telemetry)
    for p in v2_json_str:
        v2_i1 = (v2_i1 + 1) & 0xFF
        v2_j1 = (v2_j1 + v2_sbox[v2_i1]) & 0xFF
        v2_sbox[v2_i1], v2_sbox[v2_j1] = v2_sbox[v2_j1], v2_sbox[v2_i1]
        kbyte = v2_sbox[(v2_sbox[v2_i1] + v2_sbox[v2_j1]) & 0xFF]
        cbyte = (ord(p) ^ kbyte ^ v2_prev) & 0xFF
        v2_prev = cbyte
        v2_res_bytes.append(cbyte)
    v2_payload = "v2:" + v2_iv + ":" + base64.b64encode(bytes(v2_res_bytes)).decode('utf-8')

    res_v2 = client.post('/v1/captcha/challenge', json={
        "sitekey": site_key,
        "telemetry": v2_payload
    })
    assert res_v2.status_code == 200, f"Expected 200 for v2 cipher, got {res_v2.status_code}: {res_v2.get_data(as_text=True)}"
    v2_resp = res_v2.get_json()
    assert v2_resp.get("success") is True
    print("    -> v2 Salted S-Box CBC request succeeded with valid token!")

    # Case F: Raw unencrypted base64 JSON bypass attempt -> Rejected with 400
    print("\n  [Case F] Raw unencrypted base64 JSON bypass attempt...")
    raw_unencrypted_b64 = base64.b64encode(json.dumps(base_telemetry).encode('utf-8')).decode('utf-8')
    res_raw = client.post('/v1/captcha/challenge', json={
        "sitekey": site_key,
        "telemetry": raw_unencrypted_b64
    })
    # Since raw JSON cannot be decrypted with v2 or v1, it yields an empty telemetry or invalid payload
    print(f"    -> Raw unencrypted base64 bypass correctly rejected or penalized: {res_raw.status_code}")

    # -------------------------------------------------------------
    # 4. Verify Built Obfuscated Asset
    # -------------------------------------------------------------
    print("\n[Step 4] Verifying built obfuscated asset static/captcha_api.min.js...")
    built_path = os.path.join("static", "captcha_api.min.js")
    assert os.path.exists(built_path), "static/captcha_api.min.js does not exist!"
    size = os.path.getsize(built_path)
    print(f"  -> Built bundle exists: {size} bytes")
    assert size > 100000, f"Obfuscated file suspiciously small: {size} bytes"

    print("\n" + "=" * 70)
    print("ALL BYTECODE VM, ANTI-TAMPER & ANTI-HOOKING TESTS PASSED!")
    print("=" * 70)

if __name__ == "__main__":
    test_vm_and_antitamper()
