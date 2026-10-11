import os
from app import app

# Aliases for WSGI servers (e.g., Gunicorn looking for main:app, main:main, main:application)
application = app
main = app

if __name__ == "__main__":
    port = int(os.getenv("PORT", 4757))
    debug = os.getenv("DEBUG", "False").lower() in ["true", "1"]
    app.run(host="0.0.0.0", port=port, debug=debug)
