import os
import ipaddress
from flask import request
from flask_sqlalchemy import SQLAlchemy
from flask_limiter import Limiter

def get_client_ip():
    """Retrieve client IP address strictly prioritizing CF-Connecting-IP with validation."""
    try:
        if request:
            cf_ip = request.headers.get("CF-Connecting-IP")
            if cf_ip and cf_ip.strip():
                clean_ip = cf_ip.strip().split(",")[0].strip()
                try:
                    ipaddress.ip_address(clean_ip)
                    return clean_ip
                except ValueError:
                    pass
            remote = request.remote_addr
            if remote and remote.strip():
                try:
                    ipaddress.ip_address(remote.strip())
                    return remote.strip()
                except ValueError:
                    pass
    except Exception:
        pass
    return "127.0.0.1"

db = SQLAlchemy()
ratelimit_storage = os.getenv("REDIS_URL") or os.getenv("RATELIMIT_STORAGE_URI") or "memory://"
limiter = Limiter(key_func=get_client_ip, default_limits=["50 per minute"], storage_uri=ratelimit_storage)