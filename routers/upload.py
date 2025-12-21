from flask import Blueprint, request, jsonify, g
from sqlalchemy.orm import Session
from datetime import datetime
import os
import uuid
import shutil
import models
from routers.auth import get_db, get_current_admin_user

upload_bp = Blueprint('upload', __name__, url_prefix='/upload')

# Upload directory configuration
UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "static", "uploads")
ALLOWED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/gif", "image/webp"}
ALLOWED_VIDEO_TYPES = {"video/mp4", "video/webm", "video/quicktime"}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10MB
MAX_VIDEO_SIZE = 100 * 1024 * 1024  # 100MB


def ensure_upload_dirs():
    """Create upload directories if they don't exist"""
    dirs = ["barbers", "customers", "appointments"]
    for d in dirs:
        path = os.path.join(UPLOAD_DIR, d)
        os.makedirs(path, exist_ok=True)


def get_file_extension(filename: str) -> str:
    """Get file extension from filename"""
    return os.path.splitext(filename)[1].lower() if filename else ""


def generate_unique_filename(original_filename: str) -> str:
    """Generate a unique filename preserving extension"""
    ext = get_file_extension(original_filename)
    return f"{uuid.uuid4().hex}{ext}"


@upload_bp.route("/barber/<int:barber_id>/avatar", methods=["POST"])
def upload_barber_avatar(barber_id):
    """Upload avatar for a barber"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    ensure_upload_dirs()
    
    db = get_db()
    
    # Verify barber exists
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        return jsonify({"detail": "Barbeiro não encontrado"}), 404
    
    if 'file' not in request.files:
        return jsonify({"detail": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"detail": "No selected file"}), 400

    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
         # Fallback check extension if content-type is octet-stream
         ext = get_file_extension(file.filename)
         if ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
             return jsonify({"detail": "Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP."}), 400
    
    # Generate unique filename and save
    filename = generate_unique_filename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, "barbers", filename)
    
    file.save(file_path)
    
    # Update barber's avatar_url
    barber.avatar_url = f"/static/uploads/barbers/{filename}"
    db.commit()
    
    return jsonify({"avatar_url": barber.avatar_url})


@upload_bp.route("/appointment/<int:appointment_id>/media", methods=["POST"])
def upload_appointment_media(appointment_id):
    """Upload photo or video for an appointment (haircut result)"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    ensure_upload_dirs()
    
    db = get_db()
    
    # Verify appointment exists
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        return jsonify({"detail": "Agendamento não encontrado"}), 404
    
    if 'file' not in request.files:
        return jsonify({"detail": "No file part"}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({"detail": "No selected file"}), 400

    # Determine media type and validate
    media_type = "image"
    if file.content_type in ALLOWED_VIDEO_TYPES:
        media_type = "video"
    elif file.content_type not in ALLOWED_IMAGE_TYPES:
         # Loose check extensions
         ext = get_file_extension(file.filename)
         if ext in ['.mp4', '.webm', '.mov']:
             media_type = "video"
         elif ext not in ['.jpg', '.jpeg', '.png', '.gif', '.webp']:
            return jsonify({"detail": "Tipo de arquivo não permitido."}), 400
    
    # Generate unique filename and save
    filename = generate_unique_filename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, "appointments", filename)
    
    file.save(file_path)
    
    # Create media record
    media_url = f"/static/uploads/appointments/{filename}"
    media = models.AppointmentMedia(
        appointment_id=appointment_id,
        media_url=media_url,
        media_type=media_type,
        created_at=datetime.utcnow()
    )
    db.add(media)
    
    # Mark appointment as completed if not already
    if appointment.status == "scheduled":
        appointment.status = "completed"
    
    db.commit()
    db.refresh(media)
    
    return jsonify({
        "id": media.id,
        "media_url": media.media_url,
        "media_type": media.media_type
    })


@upload_bp.route("/media/<int:media_id>", methods=["DELETE"])
def delete_media(media_id):
    """Delete a media file"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    db = get_db()
    media = db.query(models.AppointmentMedia).filter(models.AppointmentMedia.id == media_id).first()
    if not media:
        return jsonify({"detail": "MÃ­dia não encontrada"}), 404
    
    # Delete file from disk
    file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), media.media_url.lstrip("/"))
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Delete from database
    db.delete(media)
    db.commit()
    
    return jsonify({"ok": True})

