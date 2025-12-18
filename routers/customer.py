from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
import models, schemas
from database import get_db
from routers.auth import get_password_hash, verify_password, create_access_token

router = APIRouter(
    prefix="/customer",
    tags=["customer"]
)

# =============== PHONE CHECK ===============

@router.get("/check-phone")
def check_phone_exists(phone: str, db: Session = Depends(get_db)):
    """Check if a phone number is already registered"""
    try:
        normalized_phone = schemas.validate_brazilian_phone(phone)
    except ValueError:
        return {"exists": False}
    
    exists = db.query(models.Customer).filter(models.Customer.phone == normalized_phone).first() is not None
    return {"exists": exists}

# =============== CUSTOMER AUTHENTICATION ===============

@router.post("/register", response_model=schemas.CustomerToken)
def register_customer(customer: schemas.CustomerCreate, db: Session = Depends(get_db)):
    """Register a new customer account"""
    # Check if phone already exists
    existing = db.query(models.Customer).filter(models.Customer.phone == customer.phone).first()
    if existing:
        raise HTTPException(status_code=400, detail="Telefone já cadastrado")
    
    # Check email if provided
    if customer.email:
        existing_email = db.query(models.Customer).filter(models.Customer.email == customer.email).first()
        if existing_email:
            raise HTTPException(status_code=400, detail="Email já cadastrado")
    
    # Create customer
    hashed_password = get_password_hash(customer.password)
    db_customer = models.Customer(
        name=customer.name,
        phone=customer.phone,
        email=customer.email,
        hashed_password=hashed_password
    )
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    
    # Generate token
    access_token = create_access_token(data={"sub": f"customer:{db_customer.id}"})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "customer": db_customer
    }

@router.post("/login", response_model=schemas.CustomerToken)
def login_customer(credentials: schemas.CustomerLogin, db: Session = Depends(get_db)):
    """Login customer with phone and password"""
    # Normalize phone
    try:
        normalized_phone = schemas.validate_brazilian_phone(credentials.phone)
    except ValueError:
        raise HTTPException(status_code=400, detail="Telefone inválido")
    
    customer = db.query(models.Customer).filter(models.Customer.phone == normalized_phone).first()
    if not customer or not verify_password(credentials.password, customer.hashed_password):
        raise HTTPException(status_code=401, detail="Telefone ou senha incorretos")
    
    access_token = create_access_token(data={"sub": f"customer:{customer.id}"})
    
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "customer": customer
    }

# =============== CUSTOMER PROFILE ===============

def get_current_customer(token: str, db: Session):
    """Utility to get current customer from token"""
    from jose import JWTError, jwt
    from routers.auth import SECRET_KEY, ALGORITHM
    
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub or not sub.startswith("customer:"):
            return None
        customer_id = int(sub.split(":")[1])
        return db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    except (JWTError, ValueError):
        return None

@router.get("/profile", response_model=schemas.Customer)
def get_profile(token: str, db: Session = Depends(get_db)):
    """Get current customer profile"""
    customer = get_current_customer(token, db)
    if not customer:
        raise HTTPException(status_code=401, detail="Não autenticado")
    return customer

@router.put("/profile", response_model=schemas.Customer)
def update_profile(token: str, update: schemas.CustomerUpdate, db: Session = Depends(get_db)):
    """Update customer profile"""
    customer = get_current_customer(token, db)
    if not customer:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    if update.name:
        customer.name = update.name
    if update.email:
        customer.email = update.email
    
    db.commit()
    db.refresh(customer)
    return customer

# =============== APPOINTMENT HISTORY ===============

@router.get("/history", response_model=List[schemas.AppointmentHistory])
def get_appointment_history(token: str, db: Session = Depends(get_db)):
    """Get customer's appointment history"""
    customer = get_current_customer(token, db)
    if not customer:
        raise HTTPException(status_code=401, detail="Não autenticado")
    
    appointments = db.query(models.Appointment).filter(
        models.Appointment.customer_id == customer.id
    ).order_by(models.Appointment.start_time.desc()).all()
    
    result = []
    for app in appointments:
        barber_name = app.barber.name if app.barber else None
        service_name = None
        if app.barber_service:
            service_name = app.barber_service.name
        elif app.service:
            service_name = app.service.name
        
        result.append({
            "id": app.id,
            "start_time": app.start_time,
            "end_time": app.end_time,
            "barber_name": barber_name,
            "service_name": service_name
        })
    
    return result
