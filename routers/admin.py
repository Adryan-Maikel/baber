from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Dict, Any, Optional
from datetime import date, timedelta, datetime
import models, schemas
from database import get_db
from routers.auth import get_current_admin_user, get_current_panel_user, get_password_hash

router = APIRouter(
    prefix="/panel",
    tags=["panel"]
)

# =============== BARBER CRUD ===============

@router.get("/barbers", response_model=List[schemas.Barber])
def list_barbers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    """List all barbers with their services"""
    return db.query(models.Barber).all()

@router.post("/barbers", response_model=schemas.Barber)
def create_barber(barber: schemas.BarberCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    """Create a new barber"""
    db_barber = models.Barber(**barber.model_dump(exclude={'password'}))
    if barber.password:
        db_barber.hashed_password = get_password_hash(barber.password)
    db.add(db_barber)
    db.commit()
    db.refresh(db_barber)
    return db_barber

@router.get("/barbers/{barber_id}", response_model=schemas.Barber)
def get_barber(barber_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    """Get a specific barber with services"""
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    return barber

@router.put("/barbers/{barber_id}", response_model=schemas.Barber)
def update_barber(barber_id: int, barber_update: schemas.BarberUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    """Update a barber's info"""
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not db_barber:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    
    update_data = barber_update.model_dump(exclude_unset=True)
    if 'password' in update_data and update_data['password']:
        update_data['hashed_password'] = get_password_hash(update_data['password'])
        del update_data['password']
        
    for key, value in update_data.items():
        setattr(db_barber, key, value)
    
    db.commit()
    db.refresh(db_barber)
    return db_barber

@router.delete("/barbers/{barber_id}")
def delete_barber(barber_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    """Delete a barber and all their services"""
    db_barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not db_barber:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    db.delete(db_barber)
    db.commit()
    return {"ok": True}

# =============== BARBER SERVICES CRUD ===============

@router.get("/barbers/{barber_id}/services", response_model=List[schemas.BarberService])
def list_barber_services(barber_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    """Get all services for a barber"""
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    return barber.services

@router.post("/barbers/{barber_id}/services", response_model=schemas.BarberService)
def create_barber_service(barber_id: int, service: schemas.BarberServiceCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    """Add a service to a barber"""
    barber = db.query(models.Barber).filter(models.Barber.id == barber_id).first()
    if not barber:
        raise HTTPException(status_code=404, detail="Barbeiro não encontrado")
    
    db_service = models.BarberService(barber_id=barber_id, **service.model_dump())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service

@router.put("/barbers/{barber_id}/services/{service_id}", response_model=schemas.BarberService)
def update_barber_service(barber_id: int, service_id: int, service_update: schemas.BarberServiceUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    """Update a barber's service"""
    db_service = db.query(models.BarberService).filter(
        models.BarberService.id == service_id,
        models.BarberService.barber_id == barber_id
    ).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    
    update_data = service_update.model_dump(exclude_unset=True)
    
    # Validate discount if both price and discount are being updated
    new_price = update_data.get('price', db_service.price)
    new_discount = update_data.get('discount_price', db_service.discount_price)
    if new_discount is not None and new_discount > new_price:
        raise HTTPException(status_code=400, detail="Desconto não pode ser maior que o preço")
    
    for key, value in update_data.items():
        setattr(db_service, key, value)
    
    db.commit()
    db.refresh(db_service)
    return db_service

@router.delete("/barbers/{barber_id}/services/{service_id}")
def delete_barber_service(barber_id: int, service_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    """Delete a service from a barber"""
    db_service = db.query(models.BarberService).filter(
        models.BarberService.id == service_id,
        models.BarberService.barber_id == barber_id
    ).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Serviço não encontrado")
    db.delete(db_service)
    db.commit()
    return {"ok": True}

# =============== LEGACY GLOBAL SERVICES (for backwards compat) ===============

@router.post("/services", response_model=schemas.Service)
def create_service(service: schemas.ServiceCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    db_service = models.Service(**service.model_dump())
    db.add(db_service)
    db.commit()
    db.refresh(db_service)
    return db_service

@router.get("/services", response_model=List[schemas.Service])
def read_services(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    services = db.query(models.Service).offset(skip).limit(limit).all()
    return services

@router.delete("/services/{service_id}")
def delete_service(service_id: int, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    db_service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not db_service:
        raise HTTPException(status_code=404, detail="Service not found")
    db.delete(db_service)
    db.commit()
    return {"ok": True}

# =============== APPOINTMENTS ===============

@router.get("/appointments", response_model=List[schemas.Appointment])
def read_appointments(
    date_filter: Optional[str] = None,  # YYYY-MM-DD
    barber_id: Optional[int] = None,
    skip: int = 0, 
    limit: int = 100, 
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_panel_user)
):
    """Get appointments with optional date and barber filters"""
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
    return query.order_by(models.Appointment.start_time.asc()).offset(skip).limit(limit).all()

# =============== DASHBOARD STATS ===============

@router.get("/dashboard-stats")
def get_dashboard_stats(
    barber_id: Optional[int] = None,
    start_date: Optional[str] = None,  # YYYY-MM-DD
    end_date: Optional[str] = None,    # YYYY-MM-DD
    db: Session = Depends(get_db), 
    current_user = Depends(get_current_panel_user)
):
    """Get dashboard stats with optional filters"""
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
        daily_stats[d_str] = {"count": 0, "revenue": 0.0}

    service_counts = {}

    for app in appointments:
        app_date_str = app.start_time.strftime("%d/%m")
        
        if app.start_time.date() == today:
            stats["count_today"] += 1
            
        if app_date_str in daily_stats:
            daily_stats[app_date_str]["count"] += 1
            
            # Calculate revenue from barber_service (new) or service (legacy)
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

    for label in stats["labels"]:
        data = daily_stats.get(label, {"count": 0, "revenue": 0.0})
        stats["appointments_data"].append(data["count"])
        stats["revenue_data"].append(data["revenue"])
        
    sorted_services = sorted(service_counts.items(), key=lambda item: item[1], reverse=True)[:5]
    for name, count in sorted_services:
        stats["service_distribution"]["labels"].append(name)
        stats["service_distribution"]["data"].append(count)
        
    return stats

# =============== APPOINTMENT STATUS ===============

@router.put("/appointments/{appointment_id}/complete")
def complete_appointment(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Mark appointment as completed"""
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    appointment.status = "completed"
    db.commit()
    return {"ok": True, "status": "completed"}


@router.put("/appointments/{appointment_id}/no-show")
def mark_no_show(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Mark appointment as no-show (customer didn't come)"""
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    appointment.status = "no_show"
    db.commit()
    return {"ok": True, "status": "no_show"}


@router.get("/appointments/{appointment_id}/media")
def get_appointment_media(
    appointment_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_admin_user)
):
    """Get all media for an appointment"""
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    media_list = []
    for media in appointment.media:
        media_list.append({
            "id": media.id,
            "media_url": media.media_url,
            "media_type": media.media_type,
            "created_at": media.created_at.isoformat()
        })
    
    return media_list


@router.post("/appointments/{appointment_id}/feedback")
def submit_feedback(
    appointment_id: int,
    feedback: schemas.FeedbackCreate,
    db: Session = Depends(get_db),
    current_user = Depends(get_current_panel_user)
):
    """Submit feedback for an appointment (notes, no-show status)"""
    # Check permission: Admin or the assigned Barber
    appointment = db.query(models.Appointment).filter(models.Appointment.id == appointment_id).first()
    if not appointment:
        raise HTTPException(status_code=404, detail="Agendamento não encontrado")
    
    if getattr(current_user, "role", "admin") == "barber":
        if appointment.barber_id != current_user.id:
            raise HTTPException(status_code=403, detail="Você não tem permissão para alterar este agendamento")
            
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
    return {"ok": True, "appointment_id": appointment.id}