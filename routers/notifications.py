"""
Notifications Router - In-app notification system for customers
"""

from flask import Blueprint, request, jsonify
from sqlalchemy.orm import Session
from datetime import datetime
import json
import models, schemas
from routers.auth import get_db
from routers.customer import get_auth_customer

notifications_bp = Blueprint('notifications', __name__, url_prefix='/customer/notifications')


def create_notification(db: Session, customer_id: str, notif_type: str, 
                        title: str, message: str, data: dict = None):
    """Create a notification for a customer. Can be called from any module."""
    try:
        notif = models.Notification(
            customer_id=customer_id,
            type=notif_type,
            title=title,
            message=message,
            data=json.dumps(data) if data else None
        )
        db.add(notif)
        db.commit()
        return notif
    except Exception as e:
        db.rollback()
        print(f"[Notification] Error creating notification: {e}")
        return None


@notifications_bp.route("", methods=["GET"])
def get_notifications():
    """Get customer notifications (paginated)"""
    try:
        customer = get_auth_customer()
        if not customer:
            return jsonify({"detail": "Não autenticado"}), 401
        
        db = get_db()
        page = request.args.get("page", 1, type=int)
        limit = request.args.get("limit", 20, type=int)
        limit = min(limit, 50)  # Max 50 per page
        
        offset = (page - 1) * limit
        
        notifications = db.query(models.Notification).filter(
            models.Notification.customer_id == customer.id
        ).order_by(
            models.Notification.created_at.desc()
        ).offset(offset).limit(limit).all()
        
        result = []
        for n in notifications:
            item = schemas.NotificationOut.model_validate(n).model_dump()
            if isinstance(item.get('created_at'), datetime):
                item['created_at'] = item['created_at'].isoformat()
            result.append(item)
        
        return jsonify({"notifications": result})
    except Exception as e:
        print(f"[Notification] Error fetching notifications: {e}")
        return jsonify({"notifications": []}), 200


@notifications_bp.route("/unread-count", methods=["GET"])
def get_unread_count():
    """Get count of unread notifications"""
    try:
        customer = get_auth_customer()
        if not customer:
            return jsonify({"unread_count": 0}), 200
        
        db = get_db()
        count = db.query(models.Notification).filter(
            models.Notification.customer_id == customer.id,
            models.Notification.is_read == False
        ).count()
        
        return jsonify({"unread_count": count})
    except Exception as e:
        print(f"[Notification] Error fetching unread count: {e}")
        return jsonify({"unread_count": 0}), 200


@notifications_bp.route("/mark-read", methods=["POST"])
def mark_all_read():
    """Mark all notifications as read"""
    try:
        customer = get_auth_customer()
        if not customer:
            return jsonify({"detail": "Não autenticado"}), 401
        
        db = get_db()
        db.query(models.Notification).filter(
            models.Notification.customer_id == customer.id,
            models.Notification.is_read == False
        ).update({"is_read": True})
        db.commit()
        
        return jsonify({"detail": "ok"})
    except Exception as e:
        print(f"[Notification] Error marking as read: {e}")
        return jsonify({"detail": "ok"}), 200
