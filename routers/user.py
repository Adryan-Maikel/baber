from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import models, schemas
from database import get_db

router = APIRouter(
    tags=["user"]
)

# =============== PUBLIC ENDPOINTS (No Auth Required) ===============

@router.get("/barbers", response_model=List[schemas.BarberSimple])
def get_barbers(db: Session = Depends(get_db)):
    """Get all active barbers (public endpoint)"""
    barbers = db.query(models.Barber).filter(models.Barber.is_active == True).all()
    return barbers

@router.get("/barbers/{barber_id}", response_model=schemas.Barber)
def get_barber(barber_id: int, db: Session = Depends(get_db)):
    """Get a specific barber with their services"""
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    return barber

@router.get("/barbers/{barber_id}/services", response_model=List[schemas.BarberService])
def get_barber_services(barber_id: int, db: Session = Depends(get_db)):
    """Get all services offered by a specific barber"""
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    return barber.services

# Legacy: global services (backwards compat)
@router.get("/services", response_model=List[schemas.Service])
def get_public_services(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    """Get all available global services (legacy endpoint)"""
    services = db.query(models.Service).offset(skip).limit(limit).all()
    return services

# =============== AVAILABILITY ===============

@router.get("/availability")
def get_availability(
    date_str: str, 
    barber_id: int,
    barber_service_id: Optional[int] = None,
    service_id: Optional[int] = None,  # Legacy
    db: Session = Depends(get_db)
):
    """Get available time slots for a barber on a specific date"""
    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    
    # Get barber and their working hours
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    if not barber.is_active:
        return {"slots": [], "message": "Barbeiro não está disponível"}
    
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
    except (ValueError, AttributeError):
        start_hour, start_min = 9, 0
        end_hour, end_min = 18, 0
    
    work_start = datetime.combine(target_date, datetime.min.time()).replace(hour=start_hour, minute=start_min)
    work_end = datetime.combine(target_date, datetime.min.time()).replace(hour=end_hour, minute=end_min)
    
    # Get existing appointments for this barber
    appointments = db.query(models.Appointment).filter(
        models.Appointment.barber_id == barber_id,
        models.Appointment.start_time >= work_start,
        models.Appointment.start_time < work_end
    ).all()
    
    # Generate slots
    slots = []
    current_time = work_start
    while current_time + timedelta(minutes=duration_minutes) <= work_end:
        slot_end = current_time + timedelta(minutes=duration_minutes)
        
        # Check collision
        is_free = True
        for apt in appointments:
            if (current_time < apt.end_time) and (slot_end > apt.start_time):
                is_free = False
                break
        
        if is_free:
            slots.append(current_time.strftime("%H:%M"))
        
        current_time += timedelta(minutes=30)
        
    return {"slots": slots}

# =============== BOOKING ===============

@router.post("/book", response_model=schemas.Appointment)
def book_appointment(
    appointment: schemas.AppointmentCreate, 
    customer_token: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """Book an appointment with a barber. Optionally link to customer profile."""
    
    # Validate barber
    barber = db.query(models.Barber).filter(models.Barber.id == appointment.barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    if not barber.is_active:
        raise HTTPException(status_code=400, detail="Barbeiro não está disponível")
    
    # Get duration from barber_service or service
    duration_minutes = 30  # Default
    if appointment.barber_service_id:
        barber_service = db.query(models.BarberService).filter(
            models.BarberService.id == appointment.barber_service_id,
            models.BarberService.barber_id == appointment.barber_id
        ).first()
        if not barber_service:
            raise HTTPException(status_code=404, detail="Serviço não encontrado para este barbeiro")
        duration_minutes = barber_service.duration_minutes
    elif appointment.service_id:
        service = db.query(models.Service).filter(models.Service.id == appointment.service_id).first()
        if not service:
            raise HTTPException(status_code=404, detail="Serviço não encontrado")
        duration_minutes = service.duration_minutes
    else:
        raise HTTPException(status_code=400, detail="É necessário informar um serviço")
    
    # Try to get customer from token
    customer_id = None
    if customer_token:
        from routers.customer import get_current_customer
        customer = get_current_customer(customer_token, db)
        if customer:
            customer_id = customer.id
        
    # Calculate end time
    end_time = appointment.start_time + timedelta(minutes=duration_minutes)
    
    db_appointment = models.Appointment(
        **appointment.model_dump(),
        customer_id=customer_id,
        end_time=end_time
    )
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return db_appointment
