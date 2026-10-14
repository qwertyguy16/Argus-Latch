import requests
import base64
import wave
import io
import sys

BASE_URL = "http://127.0.0.1:4757"

def test_audio_compliance():
    print("Testing Audio Compliance across all challenge types...")

    # 1. Test /v1/captcha/api.js serving
    print("\n[1] Testing /v1/captcha/api.js...")
    res = requests.get(f"{BASE_URL}/v1/captcha/api.js")
    assert res.status_code == 200, f"Failed api.js: {res.status_code}"
    assert len(res.text) > 1000, "api.js content is too short"
    print("  -> api.js fetched successfully (length:", len(res.text), ")")

    # 2. Test Audio challenge via test key argus_6x
    print("\n[2] Testing Challenge Dispatch for Audio preset (argus_6x)...")
    payload = {
        "sitekey": "argus_6x000000000000000000000000",
        "telemetry": {}
    }
    res = requests.post(f"{BASE_URL}/v1/captcha/challenge", json=payload)
    assert res.status_code == 200, f"Challenge failed: {res.status_code} {res.text}"
    data = res.json()
    assert data.get("requires_visual") is True, f"requires_visual not True: {data}"
    assert data.get("visual_type") == "audio", f"visual_type not audio: {data}"
    assert data.get("audio_only") is True, f"audio_only must be True for direct/sus clients: {data}"
    assert "audio" in data, "audio b64 missing"
    assert "visual_ticket" in data, "visual_ticket missing"
    ticket = data["visual_ticket"]
    assert ticket.startswith("aud:"), f"Ticket doesn't start with aud: {ticket}"
    print(f"  -> Direct Audio Challenge served successfully (audio_only={data.get('audio_only')}). Ticket: {ticket[:30]}...")

    # Validate audio WAV bytes
    audio_bytes = base64.b64decode(data["audio"])
    with wave.open(io.BytesIO(audio_bytes), 'rb') as w:
        channels = w.getnchannels()
        sampwidth = w.getsampwidth()
        framerate = w.getframerate()
        nframes = w.getnframes()
        duration = nframes / framerate
        print(f"  -> Validated WAV: {channels}ch, {sampwidth*8}-bit, {framerate}Hz, duration: {duration:.2f}s")
        assert channels == 1
        assert sampwidth == 2
        assert framerate == 22050
        assert duration >= 1.0

    # Extract digits from ticket (format: aud:{hex}:{digits}:{ts}.{sig})
    payload_part = ticket.rsplit('.', 1)[0]
    expected_digits = payload_part.split(':')[2]
    print(f"  -> Extracted expected digits from ticket: {expected_digits}")

    # 3. Test verification with incorrect digits
    print("\n[3] Testing incorrect audio verification rejection...")
    bad_res = requests.post(f"{BASE_URL}/v1/captcha/visual-verify", json={
        "sitekey": "argus_6x000000000000000000000000",
        "visual_ticket": ticket,
        "answer": "99999" if expected_digits != "99999" else "11111"
    })
    assert bad_res.status_code == 400, f"Expected 400 for bad answer, got {bad_res.status_code}"
    print("  -> Incorrect answer properly rejected.")

    # 4. Generate a fresh ticket to solve
    res = requests.post(f"{BASE_URL}/v1/captcha/challenge", json=payload)
    data = res.json()
    ticket = data["visual_ticket"]
    expected_digits = ticket.rsplit('.', 1)[0].split(':')[2]

    # 5. Test successful verification with correct digits
    print("\n[4] Testing correct audio verification...")
    v_res = requests.post(f"{BASE_URL}/v1/captcha/visual-verify", json={
        "sitekey": "argus_6x000000000000000000000000",
        "visual_ticket": ticket,
        "answer": expected_digits
    })
    assert v_res.status_code == 200, f"visual-verify failed: {v_res.status_code} {v_res.text}"
    v_data = v_res.json()
    assert v_data.get("success") is True, f"v_data not success: {v_data}"
    token = v_data.get("token")
    assert token, "Token missing in response"
    print(f"  -> Correct answer verified! Token issued: {token[:35]}...")

    # 6. Test replay protection on the consumed ticket
    print("\n[5] Testing replay protection on used ticket...")
    replay_res = requests.post(f"{BASE_URL}/v1/captcha/visual-verify", json={
        "sitekey": "argus_6x000000000000000000000000",
        "visual_ticket": ticket,
        "answer": expected_digits
    })
    assert replay_res.status_code == 400, f"Expected 400 on replay, got {replay_res.status_code}"
    print("  -> Replay protection verified (ticket cannot be reused).")

    # 7. Test siteverify with the audio-generated token
    print("\n[6] Testing siteverify backend token verification...")
    sv_res = requests.post(f"{BASE_URL}/v1/captcha/siteverify", data={
        "secret": "sk_6x000000000000000000000000",
        "response": token
    })
    assert sv_res.status_code == 200, f"siteverify failed: {sv_res.status_code} {sv_res.text}"
    sv_data = sv_res.json()
    assert sv_data.get("success") is True, f"siteverify success not True: {sv_data}"
    print(f"  -> siteverify PASSED! Risk Score: {sv_data.get('risk_score')}, TS: {sv_data.get('challenge_ts')}")

    # 8. Test on-demand /audio-challenge endpoint from Slider (argus_4x) & Rotation (argus_5x)
    print("\n[7] Testing On-Demand Accessibility switch for Slider and Rotation...")
    for sk, desc in [("argus_4x000000000000000000000000", "Slider"), ("argus_5x000000000000000000000000", "Rotation")]:
        aud_res = requests.post(f"{BASE_URL}/v1/captcha/audio-challenge", json={"sitekey": sk})
        assert aud_res.status_code == 200, f"Failed on-demand audio for {desc}: {aud_res.status_code} {aud_res.text}"
        aud_data = aud_res.json()
        assert aud_data.get("visual_type") == "audio"
        assert aud_data.get("audio_only") is False, f"audio_only must be False for on-demand switched audio: {aud_data}"
        assert aud_data.get("audio")
        assert aud_data.get("visual_ticket").startswith("aud:")
        print(f"  -> On-demand audio challenge accessible from {desc} challenge (audio_only={aud_data.get('audio_only')}).")

    print("\nALL AUDIO COMPLIANCE TESTS PASSED!")

if __name__ == "__main__":
    try:
        test_audio_compliance()
    except Exception as e:
        print(f"\nTEST FAILED: {e}")
        sys.exit(1)
