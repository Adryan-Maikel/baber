"""
Email Service - Sends emails using Gmail SMTP
Uses Python native smtplib (no extra dependencies needed)
Sends emails in a background thread to avoid blocking API responses
"""

import smtplib
import os
import threading
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime


# Email configuration from environment variables
EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS", "")
EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
EMAIL_ENABLED = bool(EMAIL_ADDRESS and EMAIL_PASSWORD)

# PythonAnywhere uses specific SMTP settings
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))


def _send_email_background(to_email: str, subject: str, html_body: str):
    """Send email in background thread"""
    try:
        msg = MIMEMultipart("alternative")
        msg["From"] = EMAIL_ADDRESS
        msg["To"] = to_email
        msg["Subject"] = subject
        
        html_part = MIMEText(html_body, "html", "utf-8")
        msg.attach(html_part)
        
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.ehlo()
            server.starttls()
            server.ehlo()
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.sendmail(EMAIL_ADDRESS, to_email, msg.as_string())
        
        print(f"[EMAIL] Sent to {to_email}: {subject}")
    except Exception as e:
        print(f"[EMAIL ERROR] Failed to send to {to_email}: {e}")


def send_email(to_email: str, subject: str, html_body: str):
    """Send email asynchronously (non-blocking)"""
    if not EMAIL_ENABLED:
        print("[EMAIL] Email not configured. Skipping send.")
        return
    
    thread = threading.Thread(
        target=_send_email_background,
        args=(to_email, subject, html_body),
        daemon=True
    )
    thread.start()


def _base_template(content: str) -> str:
    """Base HTML email template with professional styling"""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 20px 0;">
            <tr>
                <td align="center">
                    <table width="600" cellpadding="0" cellspacing="0" style="background-color: #141414; border-radius: 16px; border: 1px solid #262626; max-width: 600px; width: 100%;">
                        <!-- Header -->
                        <tr>
                            <td style="padding: 30px 30px 20px; text-align: center; border-bottom: 1px solid #262626;">
                                <h1 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 600;">
                                    ✂️ Barbearia Balhego
                                </h1>
                            </td>
                        </tr>
                        <!-- Content -->
                        <tr>
                            <td style="padding: 30px;">
                                {content}
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="padding: 20px 30px; text-align: center; border-top: 1px solid #262626;">
                                <p style="margin: 0; color: #666666; font-size: 12px;">
                                    Este email foi enviado automaticamente. Não responda.
                                </p>
                                <p style="margin: 5px 0 0; color: #555555; font-size: 11px;">
                                    Barbearia Balhego &copy; {datetime.now().year}
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


def send_booking_confirmation(to_email: str, customer_name: str, barber_name: str, 
                               service_name: str, date_str: str, time_str: str,
                               price: str = ""):
    """Send booking confirmation email"""
    price_html = f'<p style="margin: 8px 0 0; color: #2563eb; font-size: 18px; font-weight: 700;">R$ {price}</p>' if price else ''
    
    content = f"""
    <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 60px; height: 60px; background: #1a3a1a; border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 28px;">✅</span>
        </div>
        <h2 style="margin: 0; color: #16a34a; font-size: 20px;">Agendamento Confirmado!</h2>
    </div>
    
    <p style="color: #a0a0a0; font-size: 14px; margin: 0 0 20px;">
        Olá <strong style="color: #ffffff;">{customer_name}</strong>, seu horário foi reservado com sucesso.
    </p>
    
    <table width="100%" cellpadding="0" cellspacing="0" style="background: #1a1a1a; border-radius: 12px; border: 1px solid #262626;">
        <tr>
            <td style="padding: 20px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                        <td style="padding: 8px 0;">
                            <span style="color: #666; font-size: 12px; text-transform: uppercase;">Profissional</span><br>
                            <span style="color: #fff; font-size: 16px; font-weight: 600;">{barber_name}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;">
                            <span style="color: #666; font-size: 12px; text-transform: uppercase;">Serviço</span><br>
                            <span style="color: #fff; font-size: 16px; font-weight: 600;">{service_name}</span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 8px 0;">
                            <span style="color: #666; font-size: 12px; text-transform: uppercase;">Data & Horário</span><br>
                            <span style="color: #fff; font-size: 16px; font-weight: 600;">📅 {date_str} às {time_str}</span>
                        </td>
                    </tr>
                </table>
                {price_html}
            </td>
        </tr>
    </table>
    
    <p style="color: #666; font-size: 13px; margin: 20px 0 0; text-align: center;">
        Caso precise cancelar ou reagendar, acesse o app e vá em <strong style="color: #a0a0a0;">Meu Histórico</strong>.
    </p>
    """
    
    send_email(to_email, "✅ Agendamento Confirmado - Barbearia Balhego", _base_template(content))


def send_photo_notification(to_email: str, customer_name: str, barber_name: str):
    """Send notification when a photo is posted for the customer"""
    content = f"""
    <div style="text-align: center; margin-bottom: 24px;">
        <div style="width: 60px; height: 60px; background: #1a2a3a; border-radius: 50%; margin: 0 auto 12px; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 28px;">📸</span>
        </div>
        <h2 style="margin: 0; color: #2563eb; font-size: 20px;">Nova Foto Publicada!</h2>
    </div>
    
    <p style="color: #a0a0a0; font-size: 14px; margin: 0 0 20px;">
        Olá <strong style="color: #ffffff;">{customer_name}</strong>, 
        <strong style="color: #ffffff;">{barber_name}</strong> publicou uma foto do seu atendimento!
    </p>
    
    <p style="color: #666; font-size: 13px; margin: 20px 0 0; text-align: center;">
        Acesse o app para ver sua foto nos stories.
    </p>
    """
    
    send_email(to_email, "📸 Nova Foto - Barbearia Balhego", _base_template(content))
