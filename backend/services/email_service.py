"""
Email Service — Envio de emails transacionais via Gmail SMTP.

Configurado para Gmail com App Password. Todas as funções são best-effort:
registram erro no log mas nunca levantam exceção para o caller.

Variáveis de ambiente necessárias:
  SMTP_USER      ex: stockopsautenticador@gmail.com
  SMTP_PASSWORD  App Password de 16 chars gerado em:
                 myaccount.google.com → Segurança → Senhas de app
  FRONTEND_URL   ex: https://stockops.vercel.app (padrão: http://localhost:3000)
"""

import logging
import os
import smtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

logger = logging.getLogger("stockops.email_service")

SMTP_HOST = "smtp.gmail.com"
SMTP_PORT = 587
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _smtp_enabled() -> bool:
    return bool(SMTP_USER and SMTP_PASSWORD)


def send_invite_email(
    to_email: str,
    tenant_name: str,
    inviter_name: str,
    token: str,
) -> None:
    """
    Envia email de convite para entrar em um tenant via Gmail SMTP.

    Best-effort: loga o erro mas nunca lança exceção para o caller.
    Se EMAIL_USER/EMAIL_PASSWORD não estiverem configurados, loga warning
    com o link do convite e retorna sem quebrar o fluxo.

    Args:
        to_email: Destinatário do convite.
        tenant_name: Nome do tenant para exibir no email.
        inviter_name: Nome de exibição de quem convidou.
        token: Token do convite (usado para montar o link).
    """
    invite_link = f"{FRONTEND_URL}/invite?token={token}"

    if not _smtp_enabled():
        logger.warning(
            "SMTP_USER/SMTP_PASSWORD não configurados — email de convite não enviado. "
            "Link do convite: %s",
            invite_link,
        )
        return

    subject = f"Você foi convidado para entrar em {tenant_name} no StockOps"

    body_text = (
        f"{inviter_name} te convidou para entrar em {tenant_name} no StockOps.\n\n"
        f"Acesse o link para aceitar o convite:\n{invite_link}\n\n"
        f"O link expira em 7 dias."
    )
    body_html = f"""<!DOCTYPE html>
<html lang="pt-BR">
<body style="font-family: sans-serif; color: #1a1a1a; max-width: 520px; margin: 0 auto;">
  <h2 style="color: #4f46e5;">Convite para {tenant_name}</h2>
  <p><strong>{inviter_name}</strong> te convidou para entrar em <strong>{tenant_name}</strong> no StockOps.</p>
  <p style="margin: 24px 0;">
    <a href="{invite_link}"
       style="background:#4f46e5;color:#fff;padding:12px 24px;border-radius:6px;text-decoration:none;font-weight:bold;">
      Aceitar convite
    </a>
  </p>
  <p style="color:#666;font-size:13px;">Ou acesse diretamente: <a href="{invite_link}">{invite_link}</a></p>
  <p style="color:#999;font-size:12px;">O link expira em 7 dias. Se você não esperava este convite, ignore este email.</p>
</body>
</html>"""

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = SMTP_USER
    msg["To"] = to_email
    msg.attach(MIMEText(body_text, "plain", "utf-8"))
    msg.attach(MIMEText(body_html, "html", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=10) as server:
            server.ehlo()
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_USER, [to_email], msg.as_string())
        logger.info("Email de convite enviado: %s → %s", SMTP_USER, to_email)
    except smtplib.SMTPAuthenticationError:
        logger.error(
            "Falha de autenticação SMTP — verifique SMTP_USER e SMTP_PASSWORD. "
            "SMTP_PASSWORD deve ser um App Password, não a senha da conta Google."
        )
    except smtplib.SMTPRecipientsRefused:
        logger.error("Destinatário recusado pelo servidor SMTP: %s", to_email)
    except Exception as e:
        logger.error("Falha ao enviar email de convite para %s: %s", to_email, e)
