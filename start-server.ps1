$env:SMTP_HOST = "smtp.gmail.com"
$env:SMTP_PORT = "587"
$env:SMTP_USER = "claudioalexandreclaudio427@gmail.com"
$env:SMTP_PASS = "mzqd zjok wada plcf"
$env:EMAIL_TO = "claudioalexandreclaudio427@gmail.com"
$env:SENDER_NAME = "MECH JR Site"
$env:SENDER_EMAIL = "claudioalexandreclaudio427@gmail.com"

Write-Host "Variáveis configuradas. Iniciando servidor..." -ForegroundColor Cyan
python .\servidor.py
