from extensions import db

class CaptchaApplication(db.Model):
    __tablename__ = 'captcha_applications'

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer)
    name = db.Column(db.String(255))
    site_key = db.Column(db.String(255))
    secret_key = db.Column(db.String(255))
    domains = db.Column(db.Text)
    mode = db.Column(db.String(255), default='manual')
    block_vpns = db.Column(db.Boolean, default=False)
    strict_mode = db.Column(db.Boolean, default=False)
    under_attack_mode = db.Column(db.Boolean, default=False)
    total_challenges = db.Column(db.Integer, default=0)
    total_successes = db.Column(db.Integer, default=0)
    total_failures = db.Column(db.Integer, default=0)
    difficulty = db.Column(db.String(255), default='medium')
    theme = db.Column(db.String(255), default='auto')
    created_at = db.Column(db.DateTime, default=db.func.current_timestamp())

    def __repr__(self):
        return f"<CaptchaApplication {self.site_key}>"

class ConsumedCaptchaToken(db.Model):
    __tablename__ = 'consumed_captcha_tokens'

    id = db.Column(db.Integer, primary_key=True)
    signature = db.Column(db.String(255), unique=True, index=True)
    expires_at = db.Column(db.DateTime, index=True)

    def __repr__(self):
        return f"<ConsumedCaptchaToken {self.signature}>"

class CaptchaLog(db.Model):
    __tablename__ = 'captcha_logs'

    id = db.Column(db.Integer, primary_key=True)
    site_key = db.Column(db.String(255), index=True)
    timestamp = db.Column(db.DateTime, default=db.func.current_timestamp())
    status = db.Column(db.String(50))
    risk_score = db.Column(db.Float)
    client_ip = db.Column(db.String(255))
    vpn_detected = db.Column(db.Boolean)
    time_on_page = db.Column(db.Integer)
    mouse_score = db.Column(db.Integer)
    hardware_concurrency = db.Column(db.Integer)
    device_memory = db.Column(db.Integer)
    website_url = db.Column(db.Text)

    def __repr__(self):
        return f"<CaptchaLog {self.site_key} {self.status}>"
