from flask import Blueprint, request, jsonify, g
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Dict, Any, Optional
from datetime import date, timedelta, datetime
import models, schemas
from models import ThemeConfig
from routers.auth import get_current_admin_user, get_current_panel_user, get_password_hash, get_db, verify_password

admin_bp = Blueprint('admin', __name__, url_prefix='/panel')

# Helper to JSONify Pydantic models
def jsonify_pydantic(obj, schema=None):
    if schema:
        if isinstance(obj, list):
            return jsonify([schema.model_validate(item).model_dump() for item in obj])
        return jsonify(schema.model_validate(obj).model_dump())
    if isinstance(obj, list):
        return jsonify([item.model_dump() for item in obj])
    return jsonify(obj.model_dump())

# =============== BARBER CRUD ===============

@admin_bp.route("/barbers", methods=["GET"])
def list_barbers():
    """List all barbers with their services"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403
        
    db = get_db()
    barbers = db.query(models.Barber).all()
    return jsonify_pydantic(barbers, schemas.Barber)

@admin_bp.route("/barbers", methods=["POST"])
def create_barber():
    """Create a new barber"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    db = get_db()
    try:
        barber = schemas.BarberCreate(**request.json)
    except Exception as e:
        return jsonify({"detail": str(e)}), 400

    db_barber = models.Barber(**barber.model_dump(exclude={'password'}))
    if barber.password:
        db_barber.hashed_password = get_password_hash(barber.password)
    db.add(db_barber)
    db.commit()
    db.refresh(db_barber)
    return jsonify_pydantic(db_barber, schemas.Barber)

@admin_bp.route("/barbers/<int:barber_id>", methods=["GET"])
def get_barber(barber_id):
    """Get a specific barber with services"""
    current_user = get_current_panel_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated"}), 401

    # Check permissions
    if getattr(current_user, "role", "admin") == "barber":
        if current_user.id != barber_id:
             return jsonify({"detail": "Acesso negado"}), 403
             
    db = get_db()
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        return jsonify({"detail": "Barbeiro não encontrado"}), 404
    return jsonify_pydantic(barber, schemas.Barber)

@admin_bp.route("/barbers/<int:barber_id>", methods=["PUT"])
def update_barber(barber_id):
    """Update a barber's info"""
    current_user = get_current_panel_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated"}), 401

    # Check permissions: Admin OR the barber themselves
    if getattr(current_user, "role", "admin") == "barber":
        if current_user.id != barber_id:
             return jsonify({"detail": "VocÃª sÃ³ pode editar seu prÃ³prio perfil"}), 403
    
    db = get_db()
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not db_barber:
        return jsonify({"detail": "Barbeiro não encontrado"}), 404
    
    try:
        barber_update = schemas.BarberUpdate(**request.json)
    except Exception as e:
        return jsonify({"detail": str(e)}), 400

    update_data = barber_update.model_dump(exclude_unset=True)
    if 'password' in update_data and update_data['password']:
        update_data['hashed_password'] = get_password_hash(update_data['password'])
        del update_data['password']
        
    for key, value in update_data.items():
        setattr(db_barber, key, value)
    
    db.commit()
    db.refresh(db_barber)
    return jsonify_pydantic(db_barber, schemas.Barber)

@admin_bp.route("/admin/me", methods=["PUT"])
def update_admin_me():
    """Update current admin credentials"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403
        
    try:
        user_update = schemas.UserCreate(**request.json)
    except Exception as e:
        return jsonify({"detail": str(e)}), 400

    db = get_db()
    user = db.query(models.User).filter(models.User.id == current_user.id).first()
    if not user:
        return jsonify({"detail": "User not found"}), 404
        
    if user_update.username:
        if user_update.username != user.username:
            existing = db.query(models.User).filter(models.User.username == user_update.username).first()
            if existing:
                return jsonify({"detail": "Nome de usuÃ¡rio jÃ¡ existe"}), 400
        user.username = user_update.username
        
    if user_update.password:
        user.hashed_password = get_password_hash(user_update.password)
        
    db.commit()
    db.refresh(user)
    return jsonify({"message": "Admin updated successfully"})

@admin_bp.route("/barbers/<int:barber_id>", methods=["DELETE"])
def delete_barber(barber_id):
    """Delete a barber and all their services"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    db = get_db()
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not db_barber:
        return jsonify({"detail": "Barbeiro não encontrado"}), 404
    db.delete(db_barber)
    db.commit()
    return jsonify({"ok": True})

# =============== BARBER SERVICES CRUD ===============

@admin_bp.route("/barbers/<int:barber_id>/services", methods=["GET"])
def list_barber_services(barber_id):
    """Get all services for a barber"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    db = get_db()
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        return jsonify({"detail": "Barbeiro não encontrado"}), 404
    return jsonify_pydantic(barber.services, schemas.BarberService)

@admin_bp.route("/barbers/<int:barber_id>/services", methods=["POST"])
def create_barber_service(barber_id):
    """Add a service to a barber"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    db = get_db()
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        return jsonify({"detail": "Barbeiro não encontrado"}), 404
    
    try:
        service = schemas.BarberServiceCreate(**request.json)
    except Exception as e:
        return jsonify({"detail": str(e)}), 400

    db_service = models.BarberService(barber_id=barber_id, **service.model_dump())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return jsonify_pydantic(db_service, schemas.BarberService)

@admin_bp.route("/barbers/<int:barber_id>/services/<int:service_id>", methods=["PUT"])
def update_barber_service(barber_id, service_id):
    """Update a barber's service"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    db = get_db()
    db_service = db.query(models.BarberService).filter(
        models.BarberService.id == service_id,
        models.BarberService.barber_id == barber_id
    ).first()
    if not db_service:
        return jsonify({"detail": "ServiÃ§o não encontrado"}), 404
    
    try:
        service_update = schemas.BarberServiceUpdate(**request.json)
    except Exception as e:
         return jsonify({"detail": str(e)}), 400

    update_data = service_update.model_dump(exclude_unset=True)
    
    # Validate discount if both price and discount are being updated
    new_price = update_data.get('price', db_service.price)
    new_discount = update_data.get('discount_price', db_service.discount_price)
    if new_discount is not None and new_discount > new_price:
        return jsonify({"detail": "Desconto não pode ser maior que o preÃ§o"}), 400
    
    for key, value in update_data.items():
        setattr(db_service, key, value)
    
    db.commit()
    db.refresh(db_service)
    return jsonify_pydantic(db_service, schemas.BarberService)

@admin_bp.route("/barbers/<int:barber_id>/services/<int:service_id>", methods=["DELETE"])
def delete_barber_service(barber_id, service_id):
    """Delete a service from a barber"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    db = get_db()
    db_service = db.query(models.BarberService).filter(
        models.BarberService.id == service_id,
        models.BarberService.barber_id == barber_id
    ).first()
    if not db_service:
        return jsonify({"detail": "ServiÃ§o não encontrado"}), 404
    db.delete(db_service)
    db.commit()
    return jsonify({"ok": True})

# =============== LEGACY GLOBAL SERVICES (for backwards compat) ===============

@admin_bp.route("/services", methods=["POST"])
def create_service():
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403
        
    try:
        service = schemas.ServiceCreate(**request.json)
    except:
        return jsonify({"detail": "Invalid data"}), 400

    db = get_db()
    db_service = models.Service(**service.model_dump())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return jsonify_pydantic(db_service, schemas.Service)

@admin_bp.route("/services", methods=["GET"])
def read_services():
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403
        
    skip = request.args.get('skip', default=0, type=int)
    limit = request.args.get('limit', default=100, type=int)

    db = get_db()
    services = db.query(models.Service).offset(skip).limit(limit).all()
    return jsonify_pydantic(services, schemas.Service)

@admin_bp.route("/services/<int:service_id>", methods=["DELETE"])
def delete_service(service_id):
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    db = get_db()
    db_service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not db_service:
        return jsonify({"detail": "Service not found"}), 404
    db.delete(db_service)
    db.commit()
    return jsonify({"ok": True})

# =============== APPOINTMENTS ===============

@admin_bp.route("/appointments", methods=["GET"])
def read_appointments():
    """Get appointments with optional date and barber filters"""
    current_user = get_current_panel_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated"}), 401

    db = get_db()
    
    date_filter = request.args.get('date_filter')
    barber_id = request.args.get('barber_id', type=int)
    skip = request.args.get('skip', default=0, type=int)
    limit = request.args.get('limit', default=100, type=int)
    
    query = db.query(models.Appointment)
    
    # If user is a barber, force filter
    if getattr(current_user, "role", "admin") == "barber":
        barber_id = current_user.id

    # Filter by date (default: today)
    if date_filter:
        try:
            filter_date = datetime.strptime(date_filter, "%Y-%m-%d").date()
            start_of_day = datetime.combine(filter_date, datetime.min.time())
            end_of_day = datetime.combine(filter_date, datetime.max.time())
            query = query.filter(
                models.Appointment.start_time >= start_of_day,
                models.Appointment.start_time <= end_of_day
            )
        except ValueError:
            pass
    
    # Filter by barber
    if barber_id:
        query = query.filter(models.Appointment.barber_id == barber_id)
    
    # Order by start_time ascending (earliest first)
    appointments = query.order_by(models.Appointment.start_time.asc()).offset(skip).limit(limit).all()
    return jsonify_pydantic(appointments, schemas.AppointmentWithMedia)

# =============== DASHBOARD STATS ===============

@admin_bp.route("/dashboard-stats", methods=["GET"])
def get_dashboard_stats():
    """Get dashboard stats with optional filters"""
    current_user = get_current_panel_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated"}), 401

    db = get_db()
    
    barber_id = request.args.get('barber_id', type=int)
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # If user is a barber, force filter
    if getattr(current_user, "role", "admin") == "barber":
        barber_id = current_user.id

    today = date.today()
    
    # Parse dates or use defaults (last 7 days)
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            start_dt = today - timedelta(days=6)
    else:
        start_dt = today - timedelta(days=6)
    
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            end_dt = today
    else:
        end_dt = today
    
    # Build query
    query = db.query(models.Appointment).filter(
        models.Appointment.start_time >= datetime.combine(start_dt, datetime.min.time()),
        models.Appointment.start_time <= datetime.combine(end_dt, datetime.max.time())
    )
    
    # Filter by barber if specified
    if barber_id:
        query = query.filter(models.Appointment.barber_id == barber_id)
    
    appointments = query.all()
    
    # Calculate number of days in range
    num_days = (end_dt - start_dt).days + 1
    
    stats = {
        "labels": [],
        "appointments_data": [],
        "revenue_data": [],
        "service_distribution": {"labels": [], "data": []},
        "total_revenue": 0.0,
        "count_today": 0,
        "barber_count": db.query(models.Barber).filter(models.Barber.is_active == True).count(),
        "total_appointments": len(appointments),
        "start_date": start_dt.isoformat(),
        "end_date": end_dt.isoformat()
    }
    
    daily_stats = {}
    for i in range(num_days):
        d = start_dt + timedelta(days=i)
        d_str = d.strftime("%d/%m")
        stats["labels"].append(d_str)
        stats["appointments_data"].append(0)  # Make sure list is init with 0
        stats["revenue_data"].append(0.0)
        # New: Cancelled data
        daily_stats[d_str] = {"active": 0, "cancelled": 0, "revenue": 0.0}

    service_counts = {}

    for app in appointments:
        app_date_str = app.start_time.strftime("%d/%m")
        
        if app.start_time.date() == today:
            # Only count active for "Today's Appointments" count
            if app.status in ['scheduled', 'completed']:
                stats["count_today"] += 1
            
        if app_date_str in daily_stats:
            # Check status
            if app.status in ['cancelled', 'no_show']:
                daily_stats[app_date_str]["cancelled"] += 1
            else:
                daily_stats[app_date_str]["active"] += 1
                
                # Calculate revenue (only for active)
                price = 0.0
                s_name = None
                if app.barber_service:
                    price = app.barber_service.discount_price or app.barber_service.price
                    s_name = app.barber_service.name
                elif app.service and app.service.price:
                    try:
                        price_str = app.service.price.replace("R$", "").replace(" ", "").replace(",", ".")
                        price = float(price_str)
                        s_name = app.service.name
                    except ValueError:
                        pass
                
                daily_stats[app_date_str]["revenue"] += price
                stats["total_revenue"] += price
                
                if s_name:
                    service_counts[s_name] = service_counts.get(s_name, 0) + 1

    # Re-build lists from daily_stats
    stats["appointments_data"] = [] # Reset to fill with active
    stats["cancelled_data"] = []    # New list
    stats["revenue_data"] = []      # Reset
    
    for label in stats["labels"]:
        data = daily_stats.get(label, {"active": 0, "cancelled": 0, "revenue": 0.0})
        stats["appointments_data"].append(data["active"])
        stats["cancelled_data"].append(data["cancelled"])
        stats["revenue_data"].append(data["revenue"])
        
    sorted_services = sorted(service_counts.items(), key=lambda item: item[1], reverse=True)[:5]
    for name, count in sorted_services:
        stats["service_distribution"]["labels"].append(name)
        stats["service_distribution"]["data"].append(count)
        
    return jsonify(stats)

# =============== APPOINTMENT STATUS ===============

@admin_bp.route("/appointments/<int:appointment_id>/complete", methods=["PUT"])
def complete_appointment(appointment_id):
    """Mark appointment as completed"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    db = get_db()
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        return jsonify({"detail": "Agendamento não encontrado"}), 404
    
    appointment.status = "completed"
    db.commit()
    return jsonify({"ok": True, "status": "completed"})


@admin_bp.route("/appointments/<int:appointment_id>/no-show", methods=["PUT"])
def mark_no_show(appointment_id):
    """Mark appointment as no-show (customer didn't come)"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    db = get_db()
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        return jsonify({"detail": "Agendamento não encontrado"}), 404
    
    appointment.status = "no_show"
    db.commit()
    return jsonify({"ok": True, "status": "no_show"})


@admin_bp.route("/appointments/<int:appointment_id>/media", methods=["GET"])
def get_appointment_media(appointment_id):
    """Get all media for an appointment"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403

    db = get_db()
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        return jsonify({"detail": "Agendamento não encontrado"}), 404
    
    media_list = []
    for media in appointment.media:
        media_list.append({
            "id": media.id,
            "media_url": media.media_url,
            "media_type": media.media_type,
            "created_at": media.created_at.isoformat()
        })
    
    return jsonify(media_list)


@admin_bp.route("/appointments/<int:appointment_id>/feedback", methods=["POST"])
def submit_feedback(appointment_id):
    """Submit feedback for an appointment (notes, no-show status)"""
    current_user = get_current_panel_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated"}), 401

    db = get_db()
    # Check permission: Admin or the assigned Barber
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        return jsonify({"detail": "Agendamento não encontrado"}), 404
    
    if getattr(current_user, "role", "admin") == "barber":
        if appointment.barber_id != current_user.id:
            return jsonify({"detail": "VocÃª não tem permissÃ£o para alterar este agendamento"}), 403
    
    try:
        feedback = schemas.FeedbackCreate(**request.json)
    except:
        return jsonify({"detail": "Invalid data"}), 400

    if feedback.status:
        appointment.status = feedback.status
    if feedback.notes:
        appointment.feedback_notes = feedback.notes
        
    if feedback.media_url:
        media = models.AppointmentMedia(
            appointment_id=appointment.id,
            media_url=feedback.media_url,
            media_type=feedback.media_type
        )
        db.add(media)
        
    db.commit()
    return jsonify({"ok": True, "appointment_id": appointment.id})

    return jsonify({"ok": True, "appointment_id": appointment.id})


# =============== THEME SETTINGS ===============

@admin_bp.route("/theme", methods=["GET"])
def get_theme_settings():
    """Get current theme settings"""
    current_user = get_current_panel_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated"}), 401
        
    db = get_db()
    config = db.query(ThemeConfig).first()
    if not config:
        config = ThemeConfig()
        db.add(config)
        db.commit()
    
    # Return as dict since we didn't make a Pydantic schema yet, or just direct
    return jsonify({
        "bg_color": config.bg_color,
        "bg_secondary": config.bg_secondary,
        "card_bg": config.card_bg,
        "card_hover": config.card_hover,
        "text_primary": config.text_primary,
        "text_secondary": config.text_secondary, 
        "accent_color": config.accent_color,
        "accent_hover": config.accent_hover,
        "danger_color": config.danger_color,
        "success_color": config.success_color,
        "border_color": config.border_color,
        "star_color": config.star_color,
        "whatsapp_color": config.whatsapp_color
    })

@admin_bp.route("/theme", methods=["POST"])
def update_theme_settings():
    """Update theme settings"""
    current_user = get_current_admin_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated or not admin"}), 403
        
    data = request.json
    db = get_db()
    config = db.query(ThemeConfig).first()
    if not config:
        config = ThemeConfig()
        db.add(config)
    
    # Update fields if present
    fields = [
        "bg_color", "bg_secondary", "card_bg", "card_hover",
        "text_primary", "text_secondary",
        "accent_color", "accent_hover",
        "danger_color", "success_color",
        "border_color", "star_color", "whatsapp_color"
    ]
    
    for field in fields:
        if field in data:
            setattr(config, field, data[field])
            
    db.commit()
    return jsonify({"ok": True})


# =============== PASSWORD CHANGE ===============

@admin_bp.route("/change-password", methods=["POST"])
def change_password():
    """Change password for current user (admin or barber)"""
    current_user = get_current_panel_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated"}), 401
    
    data = request.json
    current_password = data.get("current_password")
    new_password = data.get("new_password")
    
    if not current_password or not new_password:
        return jsonify({"detail": "Senha atual e nova senha são obrigatórias"}), 400
    
    if len(new_password) < 6:
        return jsonify({"detail": "A nova senha deve ter pelo menos 6 caracteres"}), 400
    
    # Verify current password
    if not verify_password(current_password, current_user.hashed_password):
        return jsonify({"detail": "Senha atual incorreta"}), 400
    
    # Update password
    db = get_db()
    current_user.hashed_password = get_password_hash(new_password)
    db.commit()
    
    return jsonify({"ok": True, "message": "Senha alterada com sucesso"})

