from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean
from sqlalchemy.orm import relationship
from database import Base

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)

class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    duration_minutes = Column(Integer)
    price = Column(String)  # Storing as string for flexibility e.g. "R$ 30,00"

class Schedule(Base):
    __tablename__ = "schedules"

    id = Column(Integer, primary_key=True, index=True)
    day_of_week = Column(String) # e.g., "Monday", "2023-12-12" or simplified to Day Name
    start_time = Column(String) # "09:00"
    end_time = Column(String)   # "18:00"
    is_active = Column(Boolean, default=True)

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, index=True)
    customer_phone = Column(String)
    service_id = Column(Integer, ForeignKey("services.id"))
    start_time = Column(DateTime) # Full datetime
    end_time = Column(DateTime)
    
    service = relationship("Service")
