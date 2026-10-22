"""Função serverless do formulário de contato (Vercel, runtime Python).

POST /api/contato -> valida, filtra spam e envia por e-mail.
Configuração só por variáveis de ambiente (veja .env.example).
Envio: Brevo (se BREVO_API_KEY existir) ou SMTP. Nada é gravado em disco.
"""
import json
import os
import re
import smtplib
import ssl
import urllib.error
import urllib.request
from html import escape
from email.message import EmailMessage
from email.utils import formataddr

from flask import Flask, jsonify, request

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 16 * 1024  # 16 KB: mais que suficiente para o formulário

AREAS = (
    "Projetos Mecânicos",
    "Simulação computacional de componentes mecânicos",
    "Modelagem 3D para manufatura aditiva",
    "Desenvolvimento de Plataformas Digitais",
)
LIMITS = {"nome": 100, "email": 254, "telefone": 20, "area": 60, "mensagem": 2000}
EMAIL_RE = re.compile(r"^[^\s@<>\"',;]+@[^\s@<>\"',;]+\.[^\s@<>\"',;]{2,}$")
PHONE_RE = re.compile(r"^[0-9()+\-.\s]{8,20}$")
CONTROL_RE = re.compile(r"[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]")
MIN_FILL_MS = 2500  # envios mais rápidos que isso são tratados como robôs


def env(*names, default=""):
    for name in names:
        val = os.environ.get(name)
        if val is not None and val.strip():
            return val.strip()
    for name in names:
        target = name.upper().replace("-", "_").replace(" ", "_")
        for k, v in os.environ.items():
            if k.upper().replace("-", "_").replace(" ", "_") == target and v.strip():
                return v.strip()
    return default


def clean(value, limit, single_line=True):
    """Remove caracteres de controle, quebras (em campos de linha única) e corta no limite."""
    value = CONTROL_RE.sub("", str(value or "")).strip()
    if single_line:
        value = re.sub(r"[\r\n\t]+", " ", value)
    return value[: limit + 1]  # +1 para a validação detectar excesso


def validate(data):
    errors = {}
    if not 2 <= len(data["nome"]) <= LIMITS["nome"]:
        errors["nome"] = "Informe seu nome (2 a 100 caracteres)."
    if len(data["email"]) > LIMITS["email"] or not EMAIL_RE.match(data["email"]):
        errors["email"] = "Confira o e-mail. Exemplo: nome@empresa.com"
    if data["telefone"] and not PHONE_RE.match(data["telefone"]):
        errors["telefone"] = "Use só números, espaços, parênteses ou hífen."
    if data["area"] not in AREAS:
        errors["area"] = "Escolha uma área de interesse."
    if not 10 <= len(data["mensagem"]) <= LIMITS["mensagem"]:
        errors["mensagem"] = "A mensagem deve ter entre 10 e 2.000 caracteres."
    return errors


DEFAULT_TO = "mechjr.eng@gmail.com"


def recipient():
    return env("EMAIL_TO", "E-MAIL_TO", "E_MAIL_TO", default=DEFAULT_TO)


def sender_email():
    return env("SENDER_EMAIL", "E-MAIL DO REMETENTE", "E_MAIL_DO_REMETENTE") or env("SMTP_USER")


def compose(data):
    """Assunto padronizado, versão texto e versão HTML em tabela (fácil de filtrar no Gmail)."""
    subject = f"[Site Mech Jr] {data['area']} - {data['nome']}"
    rows = (
        ("Nome", data["nome"]),
        ("E-mail", data["email"]),
        ("Telefone", data["telefone"] or "não informado"),
        ("Área de interesse", data["area"]),
    )
    text = "Novo contato recebido pelo site da Mech Jr\n\n" + "".join(f"{k}: {v}\n" for k, v in rows)
    text += f"\nMensagem:\n{data['mensagem']}\n\nResponda este e-mail para falar direto com o cliente.\n"
    td = 'style="padding:8px 12px;border-bottom:1px solid #E6E8EC;font:14px Arial,sans-serif;'
    cells = "".join(
        f'<tr><th align="left" {td}color:#5B6166;width:150px">{escape(k)}</th><td {td}color:#111315">{escape(v)}</td></tr>'
        for k, v in rows
    )
    msg = escape(data["mensagem"]).replace("\n", "<br>")
    html = (
        '<div style="background:#F3F3F0;padding:24px">'
        '<table role="presentation" width="100%" style="max-width:620px;margin:auto;background:#fff;border-collapse:collapse;border-top:4px solid #E06A26">'
        '<tr><td colspan="2" style="padding:18px 12px;font:600 18px Arial,sans-serif;color:#111315">Novo contato pelo site</td></tr>'
        f"{cells}"
        f'<tr><td colspan="2" style="padding:14px 12px;font:14px/1.55 Arial,sans-serif;color:#111315"><strong>Mensagem</strong><br>{msg}</td></tr>'
        '<tr><td colspan="2" style="padding:12px;font:12px Arial,sans-serif;color:#5B6166">Responda este e-mail para falar direto com o cliente.</td></tr>'
        "</table></div>"
    )
    return subject, text, html


def send_brevo(data, subject, body, html):
    payload = {
        "sender": {"name": env("SENDER_NAME", default="Site Mech Jr"), "email": sender_email()},
        "to": [{"email": recipient(), "name": "Mech Jr"}],
        "replyTo": {"email": data["email"], "name": data["nome"]},
        "subject": subject,
        "textContent": body,
        "htmlContent": html,
        "tags": ["site-contato"],
    }
    req = urllib.request.Request(
        "https://api.brevo.com/v3/smtp/email",
        data=json.dumps(payload).encode("utf-8"),
        headers={"api-key": env("BREVO_API_KEY"), "Content-Type": "application/json", "Accept": "application/json"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as res:
            return 200 <= res.status < 300
    except urllib.error.HTTPError as exc:
        # Registra o código e a resposta do Brevo (nunca a chave) para diagnóstico nos logs da Vercel
        detail = exc.read(400).decode("utf-8", "replace")
        app.logger.error("Brevo recusou o envio: HTTP %s %s", exc.code, detail)
        raise SendError(f"brevo_{exc.code}") from None


class SendError(Exception):
    pass


def send_smtp(data, subject, body, html):
    user, password = env("SMTP_USER"), env("SMTP_PASS")
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = formataddr((env("SENDER_NAME", default="Site Mech Jr"), sender_email() or user))
    msg["To"] = recipient()
    msg["Reply-To"] = formataddr((data["nome"], data["email"]))
    msg.set_content(body)
    msg.add_alternative(html, subtype="html")
    host, port = env("SMTP_HOST", "smtp.gmail.com"), int(env("SMTP_PORT", "587") or 587)
    context = ssl.create_default_context()
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=10, context=context) as server:
            server.login(user, password)
            server.send_message(msg)
    else:
        with smtplib.SMTP(host, port, timeout=10) as server:
            server.starttls(context=context)
            server.login(user, password)
            server.send_message(msg)
    return True


def configured():
    if env("BREVO_API_KEY") and sender_email():
        return "brevo"
    if env("SMTP_USER") and env("SMTP_PASS"):
        return "smtp"
    return None


def reply(status, ok, message, errors=None, code=None):
    body = {"ok": ok, "message": message}
    if code:
        body["code"] = code  # motivo sem segredos, para diagnóstico
    if errors:
        body["errors"] = errors
    res = jsonify(body)
    res.status_code = status
    res.headers["Cache-Control"] = "no-store"
    return res


@app.errorhandler(413)
def too_large(_):
    return reply(413, False, "Mensagem grande demais.")


@app.route("/api/contato", methods=["POST", "GET", "OPTIONS"])
def contato():
    if request.method != "POST":
        return reply(405, False, "Use POST.")

    src = request.form if request.form else (request.get_json(silent=True) or {})

    # Anti-spam: campo isca preenchido ou envio rápido demais -> finge sucesso e descarta
    try:
        elapsed = int(src.get("t") or 0)
    except (TypeError, ValueError):
        elapsed = 0
    if src.get("site") or (0 < elapsed < MIN_FILL_MS):
        return reply(200, True, "Mensagem enviada.")

    data = {
        "nome": clean(src.get("nome"), LIMITS["nome"]),
        "email": clean(src.get("email"), LIMITS["email"]).lower(),
        "telefone": clean(src.get("telefone"), LIMITS["telefone"]),
        "area": clean(src.get("area"), LIMITS["area"]),
        "mensagem": clean(src.get("mensagem"), LIMITS["mensagem"], single_line=False),
    }
    errors = validate(data)
    if errors:
        return reply(400, False, "Revise os campos destacados.", errors)

    provider = configured()
    if not provider:
        app.logger.error("Formulário sem configuração de e-mail (BREVO_API_KEY + SENDER_EMAIL ou SMTP_USER/SMTP_PASS).")
        return reply(503, False, "Envio indisponível no momento.", code="not_configured")

    subject, body, html = compose(data)
    sent, code = False, None
    try:
        sent = send_brevo(data, subject, body, html) if provider == "brevo" else send_smtp(data, subject, body, html)
    except SendError as exc:
        code = str(exc)
    except Exception as exc:  # noqa: BLE001 - registra e tenta o SMTP como reserva
        code = f"{provider}_{type(exc).__name__}"
        app.logger.error("Falha no envio via %s: %s", provider, type(exc).__name__)
    if not sent and provider == "brevo" and env("SMTP_USER") and env("SMTP_PASS"):
        try:
            sent = send_smtp(data, subject, body, html)
        except Exception as exc:  # noqa: BLE001
            app.logger.error("Falha no envio via SMTP: %s", type(exc).__name__)

    if sent:
        return reply(200, True, "Mensagem enviada.")
    return reply(502, False, "Não foi possível enviar agora.", code=code or "send_failed")
