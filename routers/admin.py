from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, desc
from typing import List, Dict, Any
from datetime import date, timedelta, datetime
import models, schemas
from database import get_db
from routers.auth import get_current_admin_user

router = APIRouter(
    prefix="/admin",
    tags=["admin"]
)

# =============== BARBER CRUD ===============

@router.get("/barbers", response_model=List[schemas.Barber])
def list_barbers(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    """List all barbers with their services"""
    return db.query(models.Barber).all()

@router.post("/barbers", response_model=schemas.Barber)
def create_barber(barber: schemas.BarberCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    """Create a new barber"""
    db_barber = models.Barber(**barber.model_dump())
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
def read_appointments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    return db.query(models.Appointment).order_by(desc(models.Appointment.start_time)).offset(skip).limit(limit).all()

# =============== DASHBOARD STATS ===============

@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    today = date.today()
    start_date = today - timedelta(days=6)
    
    appointments = db.query(models.Appointment).filter(models.Appointment.start_time >= start_date).all()
    
    stats = {
        "labels": [],
        "appointments_data": [],
        "revenue_data": [],
        "service_distribution": {"labels": [], "data": []},
        "total_revenue": 0.0,
        "count_today": 0,
        "barber_count": db.query(models.Barber).filter(models.Barber.is_active == True).count()
    }
    
    daily_stats = {}
    for i in range(7):
        d = start_date + timedelta(days=i)
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
            if app.barber_service:
                price = app.barber_service.discount_price or app.barber_service.price
                s_name = app.barber_service.name
            elif app.service and app.service.price:
                try:
                    price_str = app.service.price.replace("R$", "").replace(" ", "").replace(",", ".")
                    price = float(price_str)
                    s_name = app.service.name
                except ValueError:
                    s_name = None
            else:
                s_name = None
            
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