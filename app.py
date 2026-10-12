import os
import logging
from flask import Flask, jsonify, render_template, request
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'), override=False)
load_dotenv(override=False)

from extensions import limiter, db, get_client_ip
from routes.v1.captcha import captcha_bp

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

class CFConnectingIPMiddleware:
    """WSGI middleware ensuring REMOTE_ADDR is always sourced strictly from CF-Connecting-IP."""
    def __init__(self, wsgi_app):
        self.wsgi_app = wsgi_app

    def __call__(self, environ, start_response):
        cf_ip = environ.get("HTTP_CF_CONNECTING_IP")
        if cf_ip and cf_ip.strip():
            # Cloudflare sends CF-Connecting-IP as the true client IP
            environ["REMOTE_ADDR"] = cf_ip.strip().split(",")[0].strip()
        return self.wsgi_app(environ, start_response)

PORT = int(os.getenv("PORT", 4757))

# Determine debug state dynamically
flask_debug_env = os.getenv("FLASK_DEBUG", "").strip().lower()
debug_env = os.getenv("DEBUG", "").strip().lower()
flask_env = os.getenv("FLASK_ENV", "").strip().lower()

is_debug_mode = (
    flask_debug_env in ["1", "true", "t", "yes", "on", "development", "dev"]
    or debug_env in ["1", "true", "t", "yes", "on"]
    or flask_env == "development"
)

app = Flask(__name__)
app.debug = is_debug_mode

# Reverse proxy fixes (x_for=0 prevents X-Forwarded-For from overriding CF-Connecting-IP)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=0, x_proto=1, x_host=1, x_prefix=1)
app.wsgi_app = CFConnectingIPMiddleware(app.wsgi_app)

try:
    app.json.sort_keys = False
except AttributeError:
    app.config['JSON_SORT_KEYS'] = False

def get_clean_env(key):
    val = os.getenv(key)
    if val is not None:
        val = val.strip().strip('"').strip("'")
        if val:
            return val
    return None

from db_failover import failover_manager, is_connection_or_operational_error

# Database URI selection based on debug mode:
# If Flask debug is True -> use DEV database URI
# If Flask debug is False -> use LIVE database URI
if is_debug_mode:
    primary_db_uri = (
        get_clean_env("SQLALCHEMY_DATABASE_URI_DEV")
        or get_clean_env("SQLALCHEMY_DATABASE_URI_DEVdatabase")
        or get_clean_env("SQLALCHEMY_DATABASE_URI")
        or get_clean_env("DATABASE_URL")
    )
    fallback_db_uri = (
        get_clean_env("SQLALCHEMY_DATABASE_URI_DEV_FALLBACK")
        or get_clean_env("SQLALCHEMY_DATABASE_URI_LIVE_FALLBACK")
    )
    db_source = "SQLALCHEMY_DATABASE_URI_DEV"
else:
    primary_db_uri = (
        get_clean_env("SQLALCHEMY_DATABASE_URI_LIVE")
        or get_clean_env("SQLALCHEMY_DATABASE_URI")
        or get_clean_env("DATABASE_URL")
        or get_clean_env("POSTGRES_URI")
        or get_clean_env("POSTGRES_URL")
    )
    fallback_db_uri = get_clean_env("SQLALCHEMY_DATABASE_URI_LIVE_FALLBACK")
    db_source = "SQLALCHEMY_DATABASE_URI_LIVE"

app.logger.info(f"Database mode: {'DEVELOPMENT (DEBUG)' if is_debug_mode else 'PRODUCTION (LIVE)'} | Target: {db_source}")

app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

# Initialize automatic connection fallback, write-safety system, and SQLAlchemy
failover_manager.init_app(app, db, primary_uri=primary_db_uri, fallback_uri=fallback_db_uri)

limiter.init_app(app)

app.register_blueprint(captcha_bp, url_prefix='/v1/captcha')

@app.route('/v1/db/status', methods=['GET'])
def db_status():
    """Return current database connection status, active node, and failover diagnostics."""
    return jsonify(failover_manager.get_status()), 200

@app.route('/v1/db/recover', methods=['POST'])
def db_recover():
    """Explicit health-recovery check to restore connection to primary if healthy."""
    result = failover_manager.check_and_recover_primary()
    code = 200 if result.get("success") else 503
    return jsonify(result), code

@app.after_request
def log_request(response):
    app.logger.info(f"{get_client_ip()} - {request.method} {request.path} {response.status_code}")
    return response

@app.route('/')
def test_page():
    return render_template('test.html')

@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        app.logger.warning(f"Error {e.code} - {get_client_ip()} - {request.method} {request.path}: {e.description}")
        return jsonify({
            "status": "error",
            "code": e.code,
            "message": e.description
        }), e.code

    if not failover_manager.is_fallback and is_connection_or_operational_error(e):
        app.logger.warning(f"Connection/operational error intercepted in exception handler: {e}. Initiating sticky failover.")
        failover_manager.failover_to_fallback(reason=str(e))

    import traceback
    traceback.print_exc()
    app.logger.error(f"Error 500 - {get_client_ip()} - {request.method} {request.path}: {str(e)}")
    return jsonify({
        "status": "error",
        "code": 500,
        "message": f"Internal Server Error: {str(e)}"
    }), 500

if __name__ == "__main__":
    if is_debug_mode:
        print(f"--- Starting Argus-Latch on port {PORT} (DEBUG=True) ---")
        app.run(debug=True, host="0.0.0.0", port=PORT)
    else:
        print(f"--- Starting Argus-Latch on port {PORT} ---")
        import subprocess
        import sys
        subprocess.run([sys.executable, "-m", "gunicorn", "-w", "4", "-b", f"0.0.0.0:{PORT}", "app:app"])
