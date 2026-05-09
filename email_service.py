"""
Email Service - Sends emails using Gmail API or SMTP fallback
"""

import smtplib
import os
import threading
import base64
from email.message import EmailMessage
from datetime import datetime

import google.auth.transport.requests
import google.oauth2.credentials
from googleapiclient.discovery import build

from database import SessionLocal
import models


# Legacy Email configuration from environment variables (Fallback)
LEGACY_EMAIL_ADDRESS = os.getenv("EMAIL_ADDRESS", "")
LEGACY_EMAIL_PASSWORD = os.getenv("EMAIL_PASSWORD", "")
LEGACY_EMAIL_ENABLED = bool(LEGACY_EMAIL_ADDRESS and LEGACY_EMAIL_PASSWORD)

SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))

GOOGLE_CLIENT_ID = os.getenv("GOOGLE_CLIENT_ID", "")
GOOGLE_CLIENT_SECRET = os.getenv("GOOGLE_CLIENT_SECRET", "")


def get_oauth_credentials():
    """Retrieve OAuth credentials from the database"""
    db = SessionLocal()
    try:
        config = db.query(models.AppConfig).filter(models.AppConfig.id == "default").first()
        if config and config.google_refresh_token:
            creds = google.oauth2.credentials.Credentials(
                token=config.google_access_token,
                refresh_token=config.google_refresh_token,
                token_uri="https://oauth2.googleapis.com/token",
                client_id=config.client_id or GOOGLE_CLIENT_ID,
                client_secret=config.client_secret or GOOGLE_CLIENT_SECRET
            )
            
            # Refresh token if expired or about to expire
            if not creds.valid:
                request = google.auth.transport.requests.Request()
                try:
                    print(f"[EMAIL] Attempting to refresh token for {config.email_address}...")
                    creds.refresh(request)
                    # Update token in DB
                    config.google_access_token = creds.token
                    db.commit()
                    print(f"[EMAIL] Token refreshed successfully for {config.email_address}")
                except Exception as e:
                    print(f"[EMAIL ERROR] Failed to refresh OAuth token for {config.email_address}: {e}")
                    # If invalid_grant, it means the connection is broken
                    if "invalid_grant" in str(e).lower():
                        print("[EMAIL ERROR] Connection broken (invalid_grant). User must reconnect in settings.")
                    return None, None
                    
            return creds, config.email_address
    except Exception as e:
        print(f"[EMAIL ERROR] Database error in get_oauth_credentials: {e}")
        return None, None
    finally:
        db.close()
        
    return None, None


def _send_email_background(to_email: str, subject: str, html_body: str):
    """Send email in background thread (OAuth or Legacy Fallback)"""
    try:
        creds, sender_email = get_oauth_credentials()
        
        if creds and sender_email:
            # Send using Gmail API (OAuth)
            service = build('gmail', 'v1', credentials=creds)
            message = EmailMessage()
            message.set_content("Por favor, ative o HTML no seu cliente de email para visualizar esta mensagem.")
            message.add_alternative(html_body, subtype='html')
            
            message['To'] = to_email
            message['From'] = sender_email
            message['Subject'] = subject

            # encoded message
            encoded_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            create_message = {'raw': encoded_message}

            service.users().messages().send(userId="me", body=create_message).execute()
            print(f"[EMAIL] Sent via Gmail API (OAuth) to {to_email}: {subject}")
            
        elif LEGACY_EMAIL_ENABLED:
            # Fallback to Legacy SMTP with App Password
            from email.mime.text import MIMEText
            from email.mime.multipart import MIMEMultipart
            
            msg = MIMEMultipart("alternative")
            msg["From"] = LEGACY_EMAIL_ADDRESS
            msg["To"] = to_email
            msg["Subject"] = subject
            
            html_part = MIMEText(html_body, "html", "utf-8")
            msg.attach(html_part)
            
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
                server.ehlo()
                server.starttls()
                server.ehlo()
                server.login(LEGACY_EMAIL_ADDRESS, LEGACY_EMAIL_PASSWORD)
                server.sendmail(LEGACY_EMAIL_ADDRESS, to_email, msg.as_string())
            print(f"[EMAIL] Sent via Legacy SMTP to {to_email}: {subject}")
        else:
            raise ValueError("Configuração de email não encontrada ou inválida (Token expirado ou SMTP não configurado).")
            
    except Exception as e:
        import traceback
        traceback.print_exc()
        print(f"[EMAIL ERROR] Failed to send to {to_email}: {e}")
        # Re-raise so callers (like the test route) can catch it
        raise


def send_email(to_email: str, subject: str, html_body: str):
    """Send email asynchronously (non-blocking)"""
    # Check if either OAuth or Legacy is configured before spawning thread
    db = SessionLocal()
    has_oauth = False
    try:
        config = db.query(models.AppConfig).filter(models.AppConfig.id == "default").first()
        has_oauth = bool(config and config.google_refresh_token)
    finally:
        db.close()
        
    if not has_oauth and not LEGACY_EMAIL_ENABLED:
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
