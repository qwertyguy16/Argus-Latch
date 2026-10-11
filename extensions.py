import os
from flask import request
from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter

def get_client_ip():
    """Retrieve client IP address strictly prioritizing CF-Connecting-IP."""
    try:
        if request:
            cf_ip = request.headers.get("CF-Connecting-IP")
            if cf_ip and cf_ip.strip():
                return cf_ip.strip().split(",")[0].strip()
            return request.remote_addr or "127.0.0.1"
    except Exception:
        pass
    return "127.0.0.1"

db = SQLAlchemy()
limiter = Limiter(key_func=get_client_ip, default_limits=["50 per minute"], storage_uri="memory://")