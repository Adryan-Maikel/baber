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

@router.post("/services", response_model=schemas.Service)
def create_service(service: schemas.ServiceCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    db_service = models.Service(**service.dict())
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

@router.post("/schedules", response_model=schemas.Schedule)
def create_schedule(schedule: schemas.ScheduleCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    # Check if schedule for day exists? For simplicity, allow multiple or just add
    db_schedule = models.Schedule(**schedule.dict())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)
    return db_schedule

@router.get("/schedules", response_model=List[schemas.Schedule])
def read_schedules(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    return db.query(models.Schedule).all()

@router.get("/appointments", response_model=List[schemas.Appointment])
def read_appointments(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    # In real app, filter by date range
    return db.query(models.Appointment).offset(skip).limit(limit).all()

@router.get("/dashboard-stats")
def get_dashboard_stats(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_admin_user)):
    # Calculate date range (last 7 days)
    today = date.today()
    start_date = today - timedelta(days=6) # 7 days including today
    
    # Query appointments in range
    appointments = db.query(models.Appointment).filter(models.Appointment.start_time >= start_date).all()
    
    # Initialize data structures
    stats = {
        "labels": [],
        "appointments_data": [],
        "revenue_data": [],
        "service_distribution": {
            "labels": [],
            "data": []
        },
        "total_revenue": 0.0,
        "count_today": 0
    }
    
    # Pre-fill last 7 days with 0
    daily_stats = {}
    for i in range(7):
        d = start_date + timedelta(days=i)
        d_str = d.strftime("%d/%m")
        stats["labels"].append(d_str)
        daily_stats[d_str] = {"count": 0, "revenue": 0.0}

    service_counts = {}

    for app in appointments:
        app_date_str = app.start_time.strftime("%d/%m")
        
        # Count today's appointments for the big number display
        if app.start_time.date() == today:
            stats["count_today"] += 1
            
        if app_date_str in daily_stats:
            daily_stats[app_date_str]["count"] += 1
            
            # Calculate revenue
            if app.service and app.service.price:
                try:
                    # Parse "R$ 30,00" -> 30.00
                    price_str = app.service.price.replace("R$", "").replace(" ", "").replace(",", ".")
                    price = float(price_str)
                    daily_stats[app_date_str]["revenue"] += price
                    stats["total_revenue"] += price
                except ValueError:
                    pass
        
        # Service popularity
        if app.service:
            s_name = app.service.name
            service_counts[s_name] = service_counts.get(s_name, 0) + 1

    # Populate lists for charts
    for label in stats["labels"]:
        data = daily_stats.get(label, {"count": 0, "revenue": 0.0})
        stats["appointments_data"].append(data["count"])
        stats["revenue_data"].append(data["revenue"])
        
    # Service distribution (Top 5)
    sorted_services = sorted(service_counts.items(), key=lambda item: item[1], reverse=True)[:5]
    for name, count in sorted_services:
        stats["service_distribution"]["labels"].append(name)
        stats["service_distribution"]["data"].append(count)
        
    return stats