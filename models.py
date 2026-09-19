from extensions import db, Column, Integer, String, DateTime, Boolean, Text, Float

class CaptchaApplication(db.Model):
    __tablename__ = 'captcha_applications'

    id = Integer(primary_key=True)
    user_id = Integer()
    name = String()
    site_key = String()
    secret_key = String()
    domains = Text()
    mode = String(default='manual')
    block_vpns = Boolean(default=False)
    strict_mode = Boolean(default=False)
    under_attack_mode = Boolean(default=False)
    total_challenges = Integer(default=0)
    total_successes = Integer(default=0)
    total_failures = Integer(default=0)
    difficulty = String(default='medium')
    theme = String(default='auto')
    created_at = DateTime()

    def __repr__(self):
        return f"<CaptchaApplication {self.site_key}>"

class ConsumedCaptchaToken(db.Model):
    __tablename__ = 'consumed_captcha_tokens'

    id = Integer(primary_key=True)
    signature = String(unique=True, index=True)
    expires_at = DateTime(index=True)

    def __repr__(self):
        return f"<ConsumedCaptchaToken {self.signature}>"

class CaptchaLog(db.Model):
    __tablename__ = 'captcha_logs'

    id = Integer(primary_key=True)
    site_key = String(index=True)
    timestamp = DateTime()
    status = String()
    risk_score = Float()
    client_ip = String()
    vpn_detected = Boolean()
    time_on_page = Integer()
    mouse_score = Integer()
    hardware_concurrency = Integer()
    device_memory = Integer()
    website_url = Text()

    def __repr__(self):
        return f"<CaptchaLog {self.site_key} {self.status}>"
