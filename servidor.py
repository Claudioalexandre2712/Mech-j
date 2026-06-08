

from flask import Flask, request, send_from_directory, jsonify
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import webbrowser
import requests
from dotenv import load_dotenv

# Carrega variáveis de ambiente do arquivo .env
load_dotenv()

app = Flask(__name__, static_folder="prototype", static_url_path="")

BASE_DIR = os.path.abspath(os.path.dirname(__file__))
STATIC_DIR = os.path.join(BASE_DIR, "prototype")

EMAIL_HOST = os.environ.get('SMTP_HOST', 'smtp.gmail.com')
EMAIL_PORT = int(os.environ.get('SMTP_PORT', '587'))
EMAIL_USER = os.environ.get('SMTP_USER', 'SEU_EMAIL@gmail.com')
EMAIL_PASS = os.environ.get('SMTP_PASS', 'mzqd zjok wada plcf')
EMAIL_TO = os.environ.get('EMAIL_TO', 'claudioalexandreclaudio427@gmail.com')

BREVO_API_KEY = os.environ.get('BREVO_API_KEY')

SENDER_NAME = os.environ.get('SENDER_NAME', 'MECH JR Site')
SENDER_EMAIL = os.environ.get('SENDER_EMAIL', EMAIL_USER)  

def send_via_brevo(nome, email, telefone, area, mensagem):
    if not BREVO_API_KEY:
        return False, 'BREVO_API_KEY não configurada'
    url = 'https://api.brevo.com/v3/smtp/email'
    payload = {
        'sender': { 'name': SENDER_NAME, 'email': SENDER_EMAIL },
        'to': [ { 'email': EMAIL_TO } ],
        'replyTo': { 'email': email, 'name': nome or '' },
        'subject': f'Contato do site - {nome or "Sem nome"}',
        'textContent': (
            f'Nome: {nome}\n'
            f'Email: {email}\n'
            f'Telefone: {telefone}\n'
            f'Área: {area}\n\n'
            f'Mensagem:\n{mensagem}'
        )
    }
    headers = {
        'api-key': BREVO_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    }
    try:
        r = requests.post(url, json=payload, headers=headers, timeout=15)
        if r.status_code in (200, 201, 202):
            return True, 'Enviado via Brevo'
        return False, f'Brevo erro {r.status_code}: {r.text}'
    except Exception as e:
        return False, f'Brevo exceção: {e}'

def send_via_smtp(nome, email, telefone, area, mensagem):
    msg = MIMEMultipart()
    msg['From'] = EMAIL_USER
    msg['To'] = EMAIL_TO
    msg['Subject'] = f'Contato do site - {nome or "Sem nome"}'
    body = (
        f'Nome: {nome}\nEmail: {email}\nTelefone: {telefone}\nÁrea: {area}\n\nMensagem:\n{mensagem}'
    )
    msg.attach(MIMEText(body, 'plain'))
    try:
        server = smtplib.SMTP(EMAIL_HOST, EMAIL_PORT)
        server.starttls()
        server.login(EMAIL_USER, EMAIL_PASS)
        server.sendmail(EMAIL_USER, EMAIL_TO, msg.as_string())
        server.quit()
        return True, 'Enviado via SMTP'
    except Exception as e:
        return False, str(e)

def store_local_backup(nome, email, telefone, area, mensagem):
    try:
        os.makedirs('data', exist_ok=True)
        path = os.path.join('data', 'submissions.csv')
        is_new = not os.path.exists(path)
        with open(path, 'a', encoding='utf-8') as f:
            if is_new:
                f.write('nome,email,telefone,area,mensagem\n')
            safe = lambda s: (s or '').replace('\n', ' ').replace('\r', ' ').replace(',', ';')
            f.write(f"{safe(nome)},{safe(email)},{safe(telefone)},{safe(area)},{safe(mensagem)}\n")
        return True
    except Exception:
        return False

@app.route('/')
def index():
    return send_from_directory(STATIC_DIR, 'MechJR.html')

@app.route('/<path:filename>')
def static_files(filename):
    return send_from_directory(STATIC_DIR, filename)

@app.route('/enviar', methods=['POST'])
def enviar_email():
    nome = request.form.get('nome')
    email = request.form.get('email')
    mensagem = request.form.get('mensagem')
    area = request.form.get('area')
    telefone = request.form.get('telefone')

    # Sempre salva localmente primeiro
    backup_ok = store_local_backup(nome, email, telefone, area, mensagem)
    
    ok = False
    details = ''
    
    # Tenta enviar via Brevo se configurado
    if BREVO_API_KEY:
        ok, details = send_via_brevo(nome, email, telefone, area, mensagem)
    
    # Se falhar, tenta SMTP
    if not ok:
        ok, details = send_via_smtp(nome, email, telefone, area, mensagem)

    # Se conseguiu salvar localmente mas falhou ao enviar, retorna sucesso mesmo assim
    if backup_ok:
        message = details if ok else 'Mensagem recebida e armazenada com sucesso!'
        return jsonify({'success': True, 'message': message}), 200
    else:
        return jsonify({'success': False, 'message': 'Erro ao processar mensagem'}), 500

if __name__ == "__main__":
    port = int(os.environ.get('PORT', 8000))
    url_local = f"http://localhost:{port}/"
    print("=" * 60)
    print("🚀 SERVIDOR FLASK INICIADO COM SUCESSO!")
    print("=" * 60)
    print(f"📍 URL: {url_local}")
    print(f"📁 Diretório servido: {STATIC_DIR}")
    print(f"🔌 Porta: {port}")
    print("=" * 60)
    print("\n⏸️  Pressione CTRL+C para parar o servidor\n")
    try:
        webbrowser.open(url_local)
        print("✅ Navegador aberto automaticamente!")
    except Exception:
        print(f"⚠️  Abra manualmente: {url_local}")
    app.run(host='0.0.0.0', port=port, debug=True)
