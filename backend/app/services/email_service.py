"""
Email delivery service — sends OTPs via SMTP or console output.

Toggled by the ``OTP_DELIVERY_METHOD`` environment variable so that
local development can use console logging without an SMTP server.
"""

import logging
from datetime import datetime

import aiosmtplib
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from app.config import get_settings

logger = logging.getLogger(__name__)


class EmailService:
    """Sends transactional emails (OTPs, notifications)."""

    def __init__(self) -> None:
        self.settings = get_settings()

    async def send_otp_email(self, to: str, otp: str, purpose: str) -> None:
        """
        Deliver an OTP to the user's email address.

        When ``OTP_DELIVERY_METHOD`` is ``"console"``, the OTP is printed
        to the server logs instead of being emailed (useful for development).

        Args:
            to: Recipient email address.
            otp: The 6-digit OTP string.
            purpose: Human-readable purpose (e.g. "Email Verification").
        """
        if self.settings.OTP_DELIVERY_METHOD == "console":
            logger.info(
                "\n"
                "╔══════════════════════════════════════════╗\n"
                "║        CU CAMPUS CONNECT — OTP           ║\n"
                "╠══════════════════════════════════════════╣\n"
                f"║  To:      {to:<30} ║\n"
                f"║  Purpose: {purpose:<30} ║\n"
                f"║  Code:    {otp:<30} ║\n"
                "╚══════════════════════════════════════════╝"
            )
            return

        html_body = self._build_otp_html(otp, purpose)

        message = MIMEMultipart("alternative")
        message["From"] = self.settings.SMTP_FROM_EMAIL
        message["To"] = to
        message["Subject"] = f"CU Campus Connect — Your {purpose} Code"
        message.attach(MIMEText(f"Your OTP code is: {otp}", "plain"))
        message.attach(MIMEText(html_body, "html"))

        await aiosmtplib.send(
            message,
            hostname=self.settings.SMTP_HOST,
            port=self.settings.SMTP_PORT,
            username=self.settings.SMTP_USER or None,
            password=self.settings.SMTP_PASSWORD or None,
            start_tls=True,
        )
        logger.info("OTP email sent to %s for %s", to, purpose)

    def _build_otp_html(self, otp: str, purpose: str) -> str:
        """Build an HTML email body for OTP delivery."""
        return f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin:0;padding:0;background-color:#f4f4f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7;padding:40px 0;">
                <tr>
                    <td align="center">
                        <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
                            <tr>
                                <td style="background:linear-gradient(135deg,#dc2626,#991b1b);padding:32px;text-align:center;">
                                    <h1 style="color:#ffffff;margin:0;font-size:24px;font-weight:700;">CU Campus Connect</h1>
                                </td>
                            </tr>
                            <tr>
                                <td style="padding:32px;">
                                    <h2 style="color:#1f2937;margin:0 0 8px;font-size:20px;">{purpose}</h2>
                                    <p style="color:#6b7280;margin:0 0 24px;font-size:15px;line-height:1.5;">
                                        Use the code below to complete your {purpose.lower()}. This code expires in 10 minutes.
                                    </p>
                                    <div style="background:#fef2f2;border:2px dashed #fca5a5;border-radius:8px;padding:20px;text-align:center;margin:0 0 24px;">
                                        <span style="font-size:36px;font-weight:700;letter-spacing:8px;color:#dc2626;">{otp}</span>
                                    </div>
                                    <p style="color:#9ca3af;margin:0;font-size:13px;line-height:1.5;">
                                        If you didn't request this code, you can safely ignore this email.
                                    </p>
                                </td>
                            </tr>
                            <tr>
                                <td style="background:#f9fafb;padding:16px 32px;text-align:center;">
                                    <p style="color:#9ca3af;margin:0;font-size:12px;">
                                        &copy; {datetime.now().year} CU Campus Connect — Chandigarh University. All rights reserved.
                                    </p>
                                </td>
                            </tr>
                        </table>
                    </td>
                </tr>
            </table>
        </body>
        </html>
        """



def get_email_service() -> EmailService:
    """Return an EmailService instance."""
    return EmailService()
