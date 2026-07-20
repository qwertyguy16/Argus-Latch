import os
from flask import Flask, jsonify
from werkzeug.exceptions import HTTPException
from werkzeug.middleware.proxy_fix import ProxyFix
from dotenv import load_dotenv

basedir = os.path.abspath(os.path.dirname(__file__))
load_dotenv(os.path.join(basedir, '.env'))

from extensions import limiter, db
from routes.v1.captcha import captcha_bp

PORT = int(os.getenv("PORT", 4757))
DEBUG = os.getenv("DEBUG", "True").lower() in ["true", "1"]

app = Flask(__name__)
app.wsgi_app = ProxyFix(app.wsgi_app, x_for=1, x_proto=1, x_host=1, x_prefix=1)
try:
    app.json.sort_keys = False
except AttributeError:
    app.config['JSON_SORT_KEYS'] = False

limiter.init_app(app)
db.init_app(app)

app.register_blueprint(captcha_bp, url_prefix='/v1/captcha')

@app.errorhandler(Exception)
def handle_exception(e):
    if isinstance(e, HTTPException):
        return jsonify({
            "status": "error",
            "code": e.code,
            "message": e.description
        }), e.code

    import traceback
    traceback.print_exc()
    return jsonify({
        "status": "error",
        "code": 500,
        "message": f"Internal Server Error: {str(e)}"
    }), 500

if __name__ == "__main__":
    if DEBUG:
        print(f"--- Starting Argus-Latch on port {PORT} (DEBUG=True) ---")
        app.run(debug=True, host="0.0.0.0", port=PORT)
    else:
        print(f"--- Starting Argus-Latch on port {PORT} ---")
        import subprocess
        import sys
        subprocess.run([sys.executable, "-m", "gunicorn", "-w", "4", "-b", f"0.0.0.0:{PORT}", "app:app"])
