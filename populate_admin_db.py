import random
from datetime import datetime, timedelta, date
from sqlalchemy.orm import Session
from database import SessionLocal, engine
import models

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

def create_dummy_services(db: Session):
    services = [
        {"name": "Corte Masculino", "duration_minutes": 30, "price": "R$ 30,00"},
        {"name": "Barba", "duration_minutes": 20, "price": "R$ 20,00"},
        {"name": "Corte + Barba", "duration_minutes": 45, "price": "R$ 45,00"},
        {"name": "Pezinho", "duration_minutes": 10, "price": "R$ 10,00"},
    ]
    
    created_services = []
    for svc_data in services:
        existing = db.query(models.Service).filter(models.Service.name == svc_data["name"]).first()
        if not existing:
            new_service = models.Service(**svc_data)
            db.add(new_service)
            db.commit()
            db.refresh(new_service)
            created_services.append(new_service)
            print(f"Created service: {new_service.name}")
        else:
            created_services.append(existing)
    
    return created_services

def create_random_appointments(db: Session, services):
    # Determine date range: past 7 days up to yesterday
    today = date.today()
    start_date = today - timedelta(days=7)
    
    # We will generate appointments for dates from start_date to today
    
    customers = [
        ("João Silva", "11999990001"),
        ("Maria Souza", "11999990002"),
        ("Pedro Santos", "11999990003"),
        ("Lucas Oliveira", "11999990004"),
        ("Ana Pereira", "11999990005"),
        ("Carlos Ferreira", "11999990006"),
    ]
    
    total_created = 0
    
    for i in range(8): # 0 to 7 days back
        current_day = start_date + timedelta(days=i)
        
        # Random number of appointments for this day (5 to 15)
        num_apps = random.randint(5, 15)
        
        # Work hours 9:00 to 18:00
        start_hour = 9
        end_hour = 17 # Last appointment starts at 17:something
        
        for _ in range(num_apps):
            service = random.choice(services)
            customer = random.choice(customers)
            
            hour = random.randint(start_hour, end_hour)
            minute = random.choice([0, 15, 30, 45])
            
            app_start = datetime.combine(current_day, datetime.min.time().replace(hour=hour, minute=minute))
            app_end = app_start + timedelta(minutes=service.duration_minutes)
            
            # Create appointment
            appointment = models.Appointment(
                customer_name=customer[0],
                customer_phone=customer[1],
                service_id=service.id,
                start_time=app_start,
                end_time=app_end
            )
            db.add(appointment)
            total_created += 1
            
    db.commit()
    print(f"Total appointments created: {total_created}")

def main():
    db = SessionLocal()
    try:
        print("Starting data population...")
        services = create_dummy_services(db)
        if not services:
            # Fallback if query failed inside function, unlikely given logic
            services = db.query(models.Service).all()
            
        create_random_appointments(db, services)
        print("Done!")
    finally:
        db.close()

if __name__ == "__main__":
    main()
