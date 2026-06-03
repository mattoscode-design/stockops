"""
Email Service — Envio de emails transacionais via Resend.

Variáveis de ambiente necessárias:
  RESEND_API_KEY  Chave da API Resend (re_...). Obtenha em: https://resend.com/api-keys
  RESEND_FROM     Remetente verificado no Resend (padrão: StockOps <noreply@stockops.app>)
  FRONTEND_URL    URL do frontend (padrão: http://localhost:3000)

Se RESEND_API_KEY não estiver configurada, as funções logam um aviso e retornam
sem lançar exceção — o fluxo do caller não é interrompido.
"""

import logging
import os

logger = logging.getLogger("stockops.email_service")

RESEND_API_KEY = os.getenv("RESEND_API_KEY", "")
RESEND_FROM = os.getenv("RESEND_FROM", "StockOps <noreply@stockops.app>")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")


def _resend_enabled() -> bool:
    return bool(RESEND_API_KEY)


def send_invite_email(
    to_email: str,
    tenant_name: str,
    inviter_name: str,
    token: str,
) -> None:
    """
    Envia email de convite para entrar em um tenant via Resend.

    Best-effort: loga o erro mas nunca lança exceção para o caller.
    Se RESEND_API_KEY não estiver configurada, apenas loga aviso e retorna.

    Args:
        to_email: Destinatário do convite.
        tenant_name: Nome do tenant para exibir no email.
        inviter_name: Nome de exibição de quem convidou.
        token: Token do convite (usado para montar o link).
    """
    if not _resend_enabled():
        logger.warning(
            "RESEND_API_KEY não configurada — email de convite não enviado para %s. "
            "Adicione RESEND_API_KEY ao .env para habilitar o envio.",
            to_email,
        )
        return

    import resend  # importação tardia para não falhar se pacote não instalado

    resend.api_key = RESEND_API_KEY

    invite_link = f"{FRONTEND_URL}/invite?token={token}"
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

    try:
        params: resend.Emails.SendParams = {
            "from": RESEND_FROM,
            "to": [to_email],
            "subject": subject,
            "html": body_html,
            "text": body_text,
        }
        response = resend.Emails.send(params)
        logger.info(
            "Email de convite enviado via Resend: id=%s → %s",
            response.get("id") if isinstance(response, dict) else getattr(response, "id", "?"),
            to_email,
        )
    except Exception as e:
        logger.error("Falha ao enviar email de convite para %s via Resend: %s", to_email, e)
