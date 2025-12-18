from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from datetime import datetime
import os
import uuid
import shutil
import models
from database import get_db
from routers.auth import get_current_admin_user

router = APIRouter(
    prefix="/upload",
    tags=["upload"]
)

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


@router.post("/barber/{barber_id}/avatar")
async def upload_barber_avatar(
    barber_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Upload avatar for a barber"""
    ensure_upload_dirs()
    
    # Verify barber exists
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    
    # Validate file type
    if file.content_type not in ALLOWED_IMAGE_TYPES:
        raise HTTPException(status_code=400, detail="Tipo de arquivo não permitido. Use JPEG, PNG, GIF ou WebP.")
    
    # Generate unique filename and save
    filename = generate_unique_filename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, "barbers", filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    # Update barber's avatar_url
    barber.avatar_url = f"/static/uploads/barbers/{filename}"
    db.commit()
    
    return {"avatar_url": barber.avatar_url}


@router.post("/appointment/{appointment_id}/media")
async def upload_appointment_media(
    appointment_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Upload photo or video for an appointment (haircut result)"""
    ensure_upload_dirs()
    
    # Verify appointment exists
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    # Determine media type and validate
    if file.content_type in ALLOWED_IMAGE_TYPES:
        media_type = "image"
    elif file.content_type in ALLOWED_VIDEO_TYPES:
        media_type = "video"
    else:
        raise HTTPException(
            status_code=400, 
            detail="Tipo de arquivo não permitido. Use imagens (JPEG, PNG, GIF, WebP) ou vídeos (MP4, WebM)."
        )
    
    # Generate unique filename and save
    filename = generate_unique_filename(file.filename)
    file_path = os.path.join(UPLOAD_DIR, "appointments", filename)
    
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
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
    
    return {
        "id": media.id,
        "media_url": media.media_url,
        "media_type": media.media_type
    }


@router.delete("/media/{media_id}")
async def delete_media(
    media_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Delete a media file"""
    media = db.query(models.AppointmentMedia).filter(models.AppointmentMedia.id == media_id).first()
    if not media:
        raise HTTPException(status_code=404, detail="Mídia não encontrada")
    
    # Delete file from disk
    file_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), media.media_url.lstrip("/"))
    if os.path.exists(file_path):
        os.remove(file_path)
    
    # Delete from database
    db.delete(media)
    db.commit()
    
    return {"ok": True}
