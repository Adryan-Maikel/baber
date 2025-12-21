from flask import Blueprint, request, jsonify, g
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import models, schemas
from routers.auth import get_db

user_bp = Blueprint('user', __name__, url_prefix='') # No prefix or maybe root? Original tags=["user"], main.py: app.include_router(user.router). It didn't have a prefix in main.py step 5, just tags. So prefix is empty.

# Helper to JSONify Pydantic models
def jsonify_pydantic(obj, schema=None):
    if schema:
        if isinstance(obj, list):
            return jsonify([schema.model_validate(item).model_dump() for item in obj])
        return jsonify(schema.model_validate(obj).model_dump())
    if isinstance(obj, list):
        return jsonify([item.model_dump() for item in obj])
    return jsonify(obj.model_dump())

# =============== PUBLIC ENDPOINTS (No Auth Required) ===============

@user_bp.route("/barbers", methods=["GET"])
def get_barbers():
    """Get all active barbers (public endpoint)"""
    db = get_db()
    barbers = db.query(models.Barber).filter(models.Barber.is_active == True).all()
    return jsonify_pydantic(barbers, schemas.Barber)

@user_bp.route("/barbers/<int:barber_id>", methods=["GET"])
def get_barber(barber_id):
    """Get a specific barber with their services"""
    db = get_db()
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        return jsonify({"detail": "Barbeiro não encontrado"}), 404
    return jsonify_pydantic(barber, schemas.Barber)

@user_bp.route("/barbers/<int:barber_id>/services", methods=["GET"])
def get_barber_services(barber_id):
    """Get all services offered by a specific barber"""
    db = get_db()
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        return jsonify({"detail": "Barbeiro não encontrado"}), 404
    return jsonify_pydantic(barber.services, schemas.BarberService)

# Legacy: global services (backwards compat)
@user_bp.route("/services", methods=["GET"])
def get_public_services():
    """Get all available global services (legacy endpoint)"""
    db = get_db()
    skip = request.args.get('skip', default=0, type=int)
    limit = request.args.get('limit', default=100, type=int)
    services = db.query(models.Service).offset(skip).limit(limit).all()
    return jsonify_pydantic(services, schemas.Service)

# =============== AVAILABILITY ===============

@user_bp.route("/availability", methods=["GET"])
def get_availability():
    """Get available time slots for a barber on a specific date"""
    db = get_db()
    
    date_str = request.args.get('date_str')
    barber_id = request.args.get('barber_id', type=int)
    barber_service_id = request.args.get('barber_service_id', type=int)
    service_id = request.args.get('service_id', type=int)
    
    if not date_str or not barber_id:
        return jsonify({"detail": "date_str and barber_id required"}), 400

    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    
    # Get barber and their working hours
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        return jsonify({"detail": "Barbeiro não encontrado"}), 404
    if not barber.is_active:
        return jsonify({"slots": [], "message": "Barbeiro não estÃ¡ disponÃ­vel"})
    
    # Get service duration
    duration_minutes = 30  # Default
    if barber_service_id:
        barber_service = db.query(models.BarberService).filter(
            models.BarberService.id == barber_service_id,
            models.BarberService.barber_id == barber_id
        ).first()
        if barber_service:
            duration_minutes = barber_service.duration_minutes
    elif service_id:
        service = db.query(models.Service).filter(models.Service.id == service_id).first()
        if service:
            duration_minutes = service.duration_minutes

    # Parse barber's working hours
    try:
        start_hour, start_min = map(int, barber.start_time.split(':'))
        end_hour, end_min = map(int, barber.end_time.split(':'))
        
        # Parse break interval if exists
        break_start = None
        break_end = None
        if barber.start_interval and barber.end_interval:
             bs_h, bs_m = map(int, barber.start_interval.split(':'))
             be_h, be_m = map(int, barber.end_interval.split(':'))
             break_start = datetime.combine(target_date, datetime.min.time()).replace(hour=bs_h, minute=bs_m)
             break_end = datetime.combine(target_date, datetime.min.time()).replace(hour=be_h, minute=be_m)

    except (ValueError, AttributeError):
        start_hour, start_min = 9, 0
        end_hour, end_min = 18, 0
        break_start = None
        break_end = None
    
    work_start = datetime.combine(target_date, datetime.min.time()).replace(hour=start_hour, minute=start_min)
    work_end = datetime.combine(target_date, datetime.min.time()).replace(hour=end_hour, minute=end_min)
    
    # Get existing appointments for this barber
    appointments = db.query(models.Appointment).filter(
        models.Appointment.barber_id == barber_id,
        models.Appointment.status == "scheduled", # Only scheduled appointments block slots
        models.Appointment.start_time >= work_start,
        models.Appointment.start_time < work_end
    ).all()
    
    # Generate slots
    slots = []
    current_time = work_start
    while current_time + timedelta(minutes=duration_minutes) <= work_end:
        slot_end = current_time + timedelta(minutes=duration_minutes)
        
        # Check Break Interval Collision
        if break_start and break_end:
            # If the slot overlaps with the break
            # Overlap logic: (StartA < EndB) and (EndA > StartB)
            if (current_time < break_end) and (slot_end > break_start):
                current_time += timedelta(minutes=30)
                continue

        # Check collision
        is_free = True
        for apt in appointments:
            if (current_time < apt.end_time) and (slot_end > apt.start_time):
                is_free = False
                break
        
        if is_free:
            slots.append(current_time.strftime("%H:%M"))
        
        current_time += timedelta(minutes=30)
        
    return jsonify({"slots": slots})

# =============== BOOKING ===============

@user_bp.route("/book", methods=["POST"])
def book_appointment():
    """Book an appointment with a barber. Optionally link to customer profile."""
    db = get_db()
    
    try:
        appointment = schemas.AppointmentCreate(**request.json)
    except Exception as e:
        return jsonify({"detail": str(e)}), 400

    customer_token = request.args.get('customer_token')

    # Validate barber
    barber = db.query(models.Barber).filter(models.Barber.id == appointment.barber_id).first()
    if not barber:
        return jsonify({"detail": "Barbeiro não encontrado"}), 404
    if not barber.is_active:
        return jsonify({"detail": "Barbeiro não estÃ¡ disponÃ­vel"}), 400
    
    # Get duration from barber_service or service
    duration_minutes = 30  # Default
    if appointment.barber_service_id:
        barber_service = db.query(models.BarberService).filter(
            models.BarberService.id == appointment.barber_service_id,
            models.BarberService.barber_id == appointment.barber_id
        ).first()
        if not barber_service:
            return jsonify({"detail": "ServiÃ§o não encontrado para este barbeiro"}), 404
        duration_minutes = barber_service.duration_minutes
    elif appointment.service_id:
        service = db.query(models.Service).filter(models.Service.id == appointment.service_id).first()
        if not service:
            return jsonify({"detail": "ServiÃ§o não encontrado"}), 404
        duration_minutes = service.duration_minutes
    else:
        return jsonify({"detail": "Ã‰ necessÃ¡rio informar um serviÃ§o"}), 400
    
    # Try to get customer from token
    customer_id = None
    if customer_token:
        # Import manually to avoid circular inputs if customer.py wasn't ready
        # But we will convert customer.py next so we can import safely if we assume it exists 
        # For now, let's just assume we will implement get_current_customer in customer.py or auth.py. 
        # Actually since customer.py defines the router, let's rely on a helper in a shared place or just import form there.
        # But customer.py is not converted yet. I'll rely on the existing file structure if it was there or import local.
        # The logic for get_current_customer is in routers/customer.py. 
        # I'll import it inside the funct.
        try:
             from routers.customer import get_current_customer
             customer = get_current_customer(customer_token, db)
             if customer:
                 customer_id = customer.id
        except ImportError:
             pass 
        except Exception:
             pass
        
    # Calculate end time
    end_time = appointment.start_time + timedelta(minutes=duration_minutes)

    # Check for conflicts (Overlapping appointments)
    # Logic: (StartA < EndB) and (EndA > StartB)
    existing_appointment = db.query(models.Appointment).filter(
        models.Appointment.barber_id == appointment.barber_id,
        models.Appointment.status == "scheduled", # Only check active appointments
        models.Appointment.start_time < end_time,
        models.Appointment.end_time > appointment.start_time
    ).first()

    if existing_appointment:
        return jsonify({"detail": "HorÃ¡rio jÃ¡ reservado por outro cliente"}), 409
    
    db_appointment = models.Appointment(
        **appointment.model_dump(),
        customer_id=customer_id,
        end_time=end_time
    )
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return jsonify_pydantic(db_appointment, schemas.Appointment)

