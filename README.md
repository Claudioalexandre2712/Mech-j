# Mech Jr - site institucional

Site da Mech Jr, Empresa Júnior de Engenharia Mecânica da Universidade Federal de Rondonópolis (UFR).

## Estrutura

```
index.html                 página única (HTML semântico)
assets/css/main.css        tokens de design + estilos (mobile first)
assets/js/main.js          interações, formulário e coreografia de scroll
assets/vendor/             GSAP 3.12.5, ScrollTrigger e Lenis 1.1.13 (servidos localmente)
assets/fonts/              Archivo variável (pesos 100-900, larguras 62-125%), OFL
assets/img/                imagens AVIF/WebP em vários tamanhos, ícones Phosphor (icons.svg)
api/contato.py             função Python (Flask) da Vercel: POST /api/contato
vercel.json                cabeçalhos de segurança e cache, configuração da função
dev_server.py              servidor local (estático + API); não é usado na Vercel
.env.example               variáveis de ambiente do formulário
```

Arquitetura: a Vercel entrega os arquivos estáticos pela CDN. Só `/api/contato` executa Python.
Nada é gravado em disco: a mensagem sai por e-mail (Brevo, se configurado, ou SMTP).

## Rodar localmente

```bash
python -m venv .venv
.venv\Scripts\activate          # Windows  (Linux/macOS: source .venv/bin/activate)
pip install -r requirements.txt python-dotenv
copy .env.example .env          # preencha SMTP_USER, SMTP_PASS e EMAIL_TO
python dev_server.py            # http://127.0.0.1:8000
```

Sem `.env` o site funciona normalmente e o formulário responde "envio indisponível" (503).

## Variáveis de ambiente (Vercel > Settings > Environment Variables)

| Nome | Obrigatória | Exemplo |
|---|---|---|
| `EMAIL_TO` | sim | `mechjr.eng@gmail.com` |
| `SMTP_HOST` | não (padrão `smtp.gmail.com`) | `smtp.gmail.com` |
| `SMTP_PORT` | não (padrão `587`) | `587` ou `465` |
| `SMTP_USER` | sim, se usar SMTP | conta que envia |
| `SMTP_PASS` | sim, se usar SMTP | senha de app do Gmail |
| `BREVO_API_KEY` | não | se definida, é usada antes do SMTP |
| `SENDER_EMAIL` | sim, se usar Brevo | remetente verificado no Brevo |
| `SENDER_NAME` | não | `Site Mech Jr` |

## Formulário: proteções

- Validação no navegador e no servidor (tamanho, formato de e-mail e telefone, área permitida).
- Campo isca (honeypot) e tempo mínimo de preenchimento: envios de robô recebem "sucesso" e são descartados.
- Corpo limitado a 16 KB; caracteres de controle e quebras de linha removidos dos campos de cabeçalho.
- Resposta de sucesso somente quando o e-mail sai; falha de envio retorna 502 com mensagem clara.

## Acessibilidade e movimento

- Contraste AA: o laranja da marca `#C75A18` é usado só em gráficos; textos e botões usam `#B24C12`.
- `prefers-reduced-motion`: desliga rolagem suave, seção fixa, parallax e máscaras.
- Sem JavaScript, todo o conteúdo continua visível.
