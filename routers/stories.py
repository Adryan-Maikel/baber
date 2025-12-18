from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, List
import models
from database import get_db
from routers.auth import get_current_admin_user

router = APIRouter(
    prefix="/stories",
    tags=["stories"]
)

# Stories are visible for 7 days
STORIES_RETENTION_DAYS = 7


@router.get("")
def get_all_stories(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Get all stories (media from last 7 days) grouped by barber"""
    cutoff_date = datetime.utcnow() - timedelta(days=STORIES_RETENTION_DAYS)
    
    # Get all media from the last 7 days with appointment and barber info
    media_list = db.query(models.AppointmentMedia).join(
        models.Appointment
    ).filter(
        models.AppointmentMedia.created_at >= cutoff_date
    ).order_by(
        models.AppointmentMedia.created_at.desc()
    ).all()
    
    # Group by barber
    barber_stories = {}
    for media in media_list:
        appointment = media.appointment
        if not appointment or not appointment.barber:
            continue
            
        barber = appointment.barber
        if barber.id not in barber_stories:
            barber_stories[barber.id] = {
                "barber_id": barber.id,
                "barber_name": barber.name,
                "barber_avatar": barber.avatar_url,
                "stories": []
            }
        
        barber_stories[barber.id]["stories"].append({
            "id": media.id,
            "media_url": media.media_url,
            "media_type": media.media_type,
            "created_at": media.created_at.isoformat(),
            "customer_name": appointment.customer_name,
            "service_name": appointment.barber_service.name if appointment.barber_service else None
        })
    
    return list(barber_stories.values())


@router.get("/barber/{barber_id}")
def get_barber_stories(
    barber_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Get stories for a specific barber"""
    cutoff_date = datetime.utcnow() - timedelta(days=STORIES_RETENTION_DAYS)
    
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        return {"error": "Barbeiro não encontrado"}
    
    media_list = db.query(models.AppointmentMedia).join(
        models.Appointment
    ).filter(
        models.Appointment.barber_id == barber_id,
        models.AppointmentMedia.created_at >= cutoff_date
    ).order_by(
        models.AppointmentMedia.created_at.desc()
    ).all()
    
    stories = []
    for media in media_list:
        appointment = media.appointment
        stories.append({
            "id": media.id,
            "media_url": media.media_url,
            "media_type": media.media_type,
            "created_at": media.created_at.isoformat(),
            "customer_name": appointment.customer_name if appointment else None,
            "service_name": appointment.barber_service.name if appointment and appointment.barber_service else None
        })
    
    return {
        "barber_id": barber.id,
        "barber_name": barber.name,
        "barber_avatar": barber.avatar_url,
        "stories": stories
    }


@router.get("/recent")
def get_recent_stories(
    limit: int = Query(default=10, le=50),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Get most recent stories across all barbers"""
    cutoff_date = datetime.utcnow() - timedelta(days=STORIES_RETENTION_DAYS)
    
    media_list = db.query(models.AppointmentMedia).join(
        models.Appointment
    ).filter(
        models.AppointmentMedia.created_at >= cutoff_date
    ).order_by(
        models.AppointmentMedia.created_at.desc()
    ).limit(limit).all()
    
    stories = []
    for media in media_list:
        appointment = media.appointment
        barber = appointment.barber if appointment else None
        stories.append({
            "id": media.id,
            "media_url": media.media_url,
            "media_type": media.media_type,
            "created_at": media.created_at.isoformat(),
            "barber_id": barber.id if barber else None,
            "barber_name": barber.name if barber else None,
            "barber_avatar": barber.avatar_url if barber else None,
            "customer_name": appointment.customer_name if appointment else None,
            "service_name": appointment.barber_service.name if appointment and appointment.barber_service else None
        })
    
    return stories
