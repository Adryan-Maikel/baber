from flask import Blueprint, request, jsonify, g
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import models, schemas
from routers.auth import (
    get_password_hash, verify_password, create_access_token, get_db, 
    SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES,
    check_rate_limit, record_failed_attempt, clear_failed_attempts
)
from jose import jwt, JWTError
from datetime import datetime, timedelta
import re

customer_bp = Blueprint('customer', __name__, url_prefix='/customer')

# Helper to JSONify Pydantic models
def jsonify_pydantic(obj, schema=None):
    if schema:
        if isinstance(obj, list):
            return jsonify([schema.model_validate(item).model_dump() for item in obj])
        return jsonify(schema.model_validate(obj).model_dump())
    if isinstance(obj, list):
        return jsonify([item.model_dump() for item in obj])
    return jsonify(obj.model_dump())

# =============== USERNAME CHECK ===============

@customer_bp.route("/check-username", methods=["GET"])
def check_username_exists():
    """Check if a username is already registered"""
    db = get_db()
    username = request.args.get('username')
    if not username:
        return jsonify({"exists": False})
    
    exists = db.query(models.Customer).filter(models.Customer.username == username).first() is not None
    return jsonify({"exists": exists})

# =============== CUSTOMER AUTHENTICATION ===============

@customer_bp.route("/register", methods=["POST"])
def register_customer():
    """Register a new customer account with rate limiting"""
    db = get_db()
    
    # Rate limiting by IP
    client_ip = request.remote_addr or "unknown"
    identifier = f"register:{client_ip}"
    
    wait_time = check_rate_limit(db, identifier)
    if wait_time:
        return jsonify({"detail": f"Muitas tentativas. Aguarde {wait_time} segundos."}), 429
    
    # Manual validation before Pydantic
    data = request.json or {}
    
    if not data.get('username') or len(data.get('username', '').strip()) < 3:
        return jsonify({"detail": "Username deve ter pelo menos 3 caracteres"}), 400
    
    if not re.match(r'^[a-zA-Z0-9_. ]+$', data.get('username', '')):
        return jsonify({"detail": "Username deve conter apenas letras, números, espaços, pontos e underscore"}), 400
    
    if not data.get('password') or len(data.get('password', '')) < 6:
        return jsonify({"detail": "Senha deve ter pelo menos 6 caracteres"}), 400
    
    if not data.get('email') or not data.get('email', '').strip():
        return jsonify({"detail": "Email é obrigatório"}), 400
    
    if not data.get('accept_terms'):
        return jsonify({"detail": "Você deve aceitar os termos de uso"}), 400
    
    try:
        customer = schemas.CustomerCreate(**data)
    except Exception as e:
        record_failed_attempt(db, identifier)
        return jsonify({"detail": str(e)}), 400

    # Check if username already exists
    existing = db.query(models.Customer).filter(models.Customer.username == customer.username).first()
    if existing:
        record_failed_attempt(db, identifier)
        return jsonify({"detail": "Username já cadastrado"}), 400
    
    # Check email if provided
    if customer.email:
        existing_email = db.query(models.Customer).filter(models.Customer.email == customer.email).first()
        if existing_email:
            record_failed_attempt(db, identifier)
            return jsonify({"detail": "Email já cadastrado"}), 400
    
    # Create customer
    hashed_password = get_password_hash(customer.password)
    db_customer = models.Customer(
        username=customer.username,
        phone=customer.phone,
        email=customer.email,
        hashed_password=hashed_password
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    
    # Clear rate limit on success
    clear_failed_attempts(db, identifier)
    
    # Generate token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": f"customer:{db_customer.id}"},
        expires_delta=access_token_expires
    )
    
    return jsonify({
        "access_token": access_token,
        "token_type": "bearer",
        "customer": schemas.Customer.model_validate(db_customer).model_dump()
    })

@customer_bp.route("/login", methods=["POST"])
def login_customer():
    """Login customer with username and password with rate limiting"""
    db = get_db()
    
    # Rate limiting by IP + username
    client_ip = request.remote_addr or "unknown"
    data = request.json or {}
    username = data.get('username', '')
    identifier = f"customer:{client_ip}:{username}"
    
    wait_time = check_rate_limit(db, identifier)
    if wait_time:
        return jsonify({"detail": f"Muitas tentativas. Aguarde {wait_time} segundos."}), 429
    
    # Manual validation
    if not username:
        return jsonify({"detail": "Username é obrigatório"}), 400
    
    if not data.get('password'):
        return jsonify({"detail": "Senha é obrigatória"}), 400
    
    try:
        credentials = schemas.CustomerLogin(**data)
    except Exception as e:
        return jsonify({"detail": str(e)}), 400
    
    customer = db.query(models.Customer).filter(models.Customer.username == credentials.username).first()
    if not customer or not verify_password(credentials.password, customer.hashed_password):
        delay = record_failed_attempt(db, identifier)
        detail = "Username ou senha incorretos"
        if delay > 0:
            detail += f". Aguarde {delay} segundos para tentar novamente."
        return jsonify({"detail": detail}), 401
    
    # Clear rate limit on success
    clear_failed_attempts(db, identifier)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": f"customer:{customer.id}"},
        expires_delta=access_token_expires
    )
    
    return jsonify({
        "access_token": access_token,
        "token_type": "bearer",
        "customer": schemas.Customer.model_validate(customer).model_dump()
    })

# =============== CUSTOMER PROFILE ===============

def get_current_customer(token: str, db: Session):
    """Utility to get current customer from token"""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub or not sub.startswith("customer:"):
            return None
        customer_id = sub.split(":")[1] # UUID string
        return db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    except (JWTError, ValueError):
        return None

def get_auth_customer():
    """Helper to get customer from Request Authorization header"""
    try:
        auth_header = request.headers.get("Authorization")
        if not auth_header:
            token = request.args.get("token") # fallback
        else:
            token = auth_header.split(" ")[1] if " " in auth_header else auth_header
        
        if not token:
            return None
        
        return get_current_customer(token, get_db())
    except Exception as e:
        print(f"[AUTH] Error getting customer: {e}")
        return None


@customer_bp.route("/profile", methods=["GET"])
def get_profile():
    """Get current customer profile"""
    try:
        token = request.args.get('token')
        if not token:
            # Try header
            customer = get_auth_customer()
        else:
            customer = get_current_customer(token, get_db())
            
        if not customer:
            return jsonify({"detail": "não autenticado"}), 401
        return jsonify_pydantic(customer, schemas.Customer)
    except Exception as e:
        print(f"[PROFILE] Error: {e}")
        return jsonify({"detail": "Erro ao carregar perfil"}), 500

@customer_bp.route("/profile", methods=["PUT"])
def update_profile():
    """Update customer profile"""
    token = request.args.get('token')
    if not token:
         customer = get_auth_customer()
    else:
         customer = get_current_customer(token, get_db())

    if not customer:
        return jsonify({"detail": "não autenticado"}), 401
    
    try:
        update = schemas.CustomerUpdate(**request.json)
    except:
        return jsonify({"detail": "Invalid data"}), 400
    
    if update.username:
        customer.username = update.username
    if update.phone is not None:
        customer.phone = update.phone
    if update.email:
        customer.email = update.email
    
    get_db().commit()
    get_db().refresh(customer)
    return jsonify_pydantic(customer, schemas.Customer)

# =============== APPOINTMENT HISTORY ===============

@customer_bp.route("/history", methods=["GET"])
def get_appointment_history():
    """Get customer's appointment history"""
    token = request.args.get('token')
    if not token:
         customer = get_auth_customer()
    else:
         customer = get_current_customer(token, get_db())

    if not customer:
        return jsonify({"detail": "não autenticado"}), 401
    
    db = get_db()
    appointments = db.query(models.Appointment).filter(
        models.Appointment.customer_id == customer.id
    ).order_by(models.Appointment.start_time.desc()).all()
    
    result = []
    for app in appointments:
        barber_name = app.barber.name if app.barber else None
        service_name = None
        duration = None
        price = None
        if app.barber_service:
            service_name = app.barber_service.name
            duration = app.barber_service.duration_minutes
            price = app.barber_service.price
        elif app.service:
            service_name = app.service.name
            duration = app.service.duration_minutes
            # Legacy price was string, let's try to parse or just leave None if float expected
            try:
                price = float(app.service.price)
            except:
                price = 0.0
        
        # Get latest media if any
        media_url = None
        media_type = None
        story_is_public = True
        if app.media:
            # Assume last uploaded is the main one or just pick first
            latest_media = app.media[-1] 
            media_url = latest_media.media_url
            media_type = latest_media.media_type
            story_is_public = latest_media.is_public

        result.append({
            "id": app.id,
            "start_time": app.start_time.isoformat(),
            "end_time": app.end_time.isoformat(),
            "barber_name": barber_name,
            "service_name": service_name,
            "barber_id": app.barber_id,
            "barber_service_id": app.barber_service_id,
            "service_id": app.service_id,
            "duration_minutes": duration,
            "price": price,
            "status": app.status,
            "rating": app.rating,
            "feedback_notes": app.feedback_notes,
            "media_url": media_url,
            "media_type": media_type,
            "barber_avatar": app.barber.avatar_url if app.barber else None,
            "story_is_public": story_is_public
        })
    
    return jsonify(result)

@customer_bp.route("/appointments/<string:appointment_id>/cancel", methods=["POST"])
def cancel_appointment(appointment_id):
    """Cancel a scheduled appointment for the current customer"""
    token = request.args.get('token')
    if not token:
         customer = get_auth_customer()
    else:
         customer = get_current_customer(token, get_db())

    if not customer:
        return jsonify({"detail": "não autenticado"}), 401
    
    db = get_db()
    appointment = db.query(models.Appointment).filter(
        models.Appointment.id == appointment_id,
        models.Appointment.customer_id == customer.id
    ).first()
    
    if not appointment:
        return jsonify({"detail": "Agendamento não encontrado"}), 404
    
    if appointment.status != "scheduled":
        return jsonify({"detail": "Apenas agendamentos ativos podem ser cancelados"}), 400
    
    # Check if appointment is in the past
    if appointment.start_time < datetime.now():
         return jsonify({"detail": "não é possível cancelar agendamentos passados"}), 400

    # Soft delete: update status to 'cancelled' so it stays in history
    appointment.status = "cancelled"
    db.commit()
    
    return jsonify({"message": "Agendamento cancelado com sucesso"})


@customer_bp.route("/feedback", methods=["POST"])
def submit_appointment_feedback():
    """Submit rating and feedback for a past appointment"""
    token = request.args.get('token')
    if not token:
         customer = get_auth_customer()
    else:
         customer = get_current_customer(token, get_db())

    if not customer:
        return jsonify({"detail": "não autenticado"}), 401
    
    try:
        feedback_data = schemas.FeedbackCreate(**request.json)
        appointment_id = request.json.get("appointment_id")
    except Exception as e:
        return jsonify({"detail": str(e)}), 400
    
    if not appointment_id:
         return jsonify({"detail": "ID do agendamento obrigatório"}), 400

    db = get_db()
    
    # Must be customer's appointment
    appointment = db.query(models.Appointment).filter(
        models.Appointment.id == appointment_id,
        models.Appointment.customer_id == customer.id
    ).first()
    
    if not appointment:
        return jsonify({"detail": "Agendamento não encontrado"}), 404
    
    if feedback_data.rating is not None:
        appointment.rating = feedback_data.rating
        
    if feedback_data.notes is not None:
        appointment.feedback_notes = feedback_data.notes
        
    # Update privacy for associated media (stories)
    if feedback_data.is_public is not None and appointment.media:
        for m in appointment.media:
            m.is_public = feedback_data.is_public
        
    db.commit()
    
    return jsonify({"message": "Avaliação enviada com sucesso"})
