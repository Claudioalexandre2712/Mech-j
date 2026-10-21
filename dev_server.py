"""Servidor local de desenvolvimento: arquivos estáticos + /api/contato.

Uso:  pip install -r requirements.txt python-dotenv
      python dev_server.py            -> http://localhost:8000
Na Vercel este arquivo não é usado.
"""
import os
import sys
from pathlib import Path

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

from flask import send_from_directory

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "api"))
from contato import app  # noqa: E402


@app.get("/")
def home():
    return send_from_directory(ROOT, "index.html")


@app.get("/<path:path>")
def static_files(path):
    if path.startswith(("api/", ".")) or path.endswith(".py"):
        return ("", 404)
    return send_from_directory(ROOT, path)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 8000)), debug=False)
