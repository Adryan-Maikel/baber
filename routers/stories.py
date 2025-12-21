from flask import Blueprint, request, jsonify, g
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional, List
import models
from routers.auth import get_db

stories_bp = Blueprint('stories', __name__, url_prefix='/stories')

# Stories are visible for 7 days
STORIES_RETENTION_DAYS = 7


@stories_bp.route("", methods=["GET"])
def get_all_stories():
    """Get all stories (media from last 7 days) grouped by barber"""
    db = get_db()
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
    
    return jsonify(list(barber_stories.values()))


@stories_bp.route("/barber/<int:barber_id>", methods=["GET"])
def get_barber_stories(barber_id):
    """Get stories for a specific barber"""
    db = get_db()
    cutoff_date = datetime.utcnow() - timedelta(days=STORIES_RETENTION_DAYS)
    
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        return jsonify({"error": "Barbeiro não encontrado"}), 404
    
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
    
    return jsonify({
        "barber_id": barber.id,
        "barber_name": barber.name,
        "barber_avatar": barber.avatar_url,
        "stories": stories
    })


@stories_bp.route("/recent", methods=["GET"])
def get_recent_stories():
    """Get most recent stories across all barbers"""
    db = get_db()
    limit = request.args.get('limit', default=10, type=int)
    if limit > 50: limit = 50
    
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
    
    return jsonify(stories)

