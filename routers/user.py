from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime, timedelta
import models, schemas
from database import get_db

router = APIRouter(
    tags=["user"]
)

@router.get("/availability")
def get_availability(date_str: str, service_id: int, db: Session = Depends(get_db)):
    # date_str format YYYY-MM-DD
    # Simple logic: Fixed slots or minute-by-minute check?
    # Let's do simple 30 min slots for MVP or based on service duration?
    # Better: List available start times.
    
    target_date = datetime.strptime(date_str, "%Y-%m-%d").date()
    # Find schedule for this day
    # Assuming "Monday", "Tuesday" etc stored in day_of_week for simplicity or specific dates
    day_name = target_date.strftime("%A") 
    
    schedule = db.query(models.Schedule).filter(models.Schedule.day_of_week == day_name).first()
    if not schedule or not schedule.is_active:
        return {"slots": []}
    
    service = db.query(models.Service).filter(models.Service.id == service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")

    # Parse working hours
    start_hour, start_min = map(int, schedule.start_time.split(':'))
    end_hour, end_min = map(int, schedule.end_time.split(':'))
    
    work_start = datetime.combine(target_date, datetime.min.time()).replace(hour=start_hour, minute=start_min)
    work_end = datetime.combine(target_date, datetime.min.time()).replace(hour=end_hour, minute=end_min)
    
    # Get existing appointments
    appointments = db.query(models.Appointment).filter(
        models.Appointment.start_time >= work_start,
        models.Appointment.start_time < work_end
    ).all()
    
    # Generate slots
    slots = []
    current_time = work_start
    while current_time + timedelta(minutes=service.duration_minutes) <= work_end:
        slot_end = current_time + timedelta(minutes=service.duration_minutes)
        
        # Check collision
        is_free = True
        for apt in appointments:
            # Overlap logic: (StartA <= EndB) and (EndA >= StartB)
            if (current_time < apt.end_time) and (slot_end > apt.start_time):
                is_free = False
                break
        
        if is_free:
            slots.append(current_time.strftime("%H:%M"))
        
        # Step size? Let's say check every 30 mins or every service duration?
        # For flexibility, let's step 30 mins.
        current_time += timedelta(minutes=30)
        
    return {"slots": slots}

@router.post("/book", response_model=schemas.Appointment)
def book_appointment(appointment: schemas.AppointmentCreate, db: Session = Depends(get_db)):
    service = db.query(models.Service).filter(models.Service.id == appointment.service_id).first()
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
        
    # Calculate end time
    end_time = appointment.start_time + timedelta(minutes=service.duration_minutes)
    
    # Verify availability again (race condition check omitted for MVP)
    # ...
    
    db_appointment = models.Appointment(
        **appointment.dict(),
        end_time=end_time
    )
    db.add(db_appointment)
    db.commit()
    db.refresh(db_appointment)
    return db_appointment
