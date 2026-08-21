"""Optional Resend email delivery. Falls back to no-op when not configured."""

from __future__ import annotations

import logging

import httpx

from app.config import get_settings

logger = logging.getLogger(__name__)


async def send_invitation_email(
    *,
    to_email: str,
    to_name: str,
    organization_name: str,
    inviter_name: str,
    role_label: str,
    invite_url: str,
    message: str | None,
    expires_at_iso: str,
) -> bool:
    settings = get_settings()
    if not settings.resend_api_key or not settings.email_from:
        logger.info(
            "Email not configured — invitation for %s created (link must be shared manually)",
            to_email,
        )
        return False

    body_lines = [
        f"Hi {to_name},",
        "",
        f"{inviter_name} invited you to join {organization_name} on Signage "
        f"as {role_label}.",
        "",
        f"Accept your invitation: {invite_url}",
        "",
        f"This invitation expires on {expires_at_iso}.",
    ]
    if message and message.strip():
        body_lines.extend(["", f"Message from {inviter_name}:", message.strip()])

    payload = {
        "from": settings.email_from,
        "to": [to_email],
        "subject": f"You're invited to {organization_name} on Signage",
        "text": "\n".join(body_lines),
    }

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            response = await client.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json=payload,
            )
        if response.status_code >= 400:
            logger.warning(
                "Resend failed (%s): %s", response.status_code, response.text
            )
            return False
        return True
    except Exception:  # noqa: BLE001
        logger.exception("Failed to send invitation email to %s", to_email)
        return False
