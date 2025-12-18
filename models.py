from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, Boolean, Float
from sqlalchemy.orm import relationship
from database import Base
from datetime import datetime

class User(Base):
    __tablename__ = "users"
    
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    is_admin = Column(Boolean, default=False)
    avatar_url = Column(String, nullable=True)

class LoginAttempt(Base):
    """Track login attempts for rate limiting"""
    __tablename__ = "login_attempts"
    
    id = Column(Integer, primary_key=True, index=True)
    identifier = Column(String, index=True, nullable=False)  # IP or username
    attempts = Column(Integer, default=0)
    locked_until = Column(DateTime, nullable=True)
    last_attempt = Column(DateTime, default=datetime.utcnow)

class Barber(Base):
    __tablename__ = "barbers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    phone = Column(String)
    avatar_url = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    # Working hours for this barber
    start_time = Column(String, default="09:00")  # e.g., "09:00"
    end_time = Column(String, default="18:00")    # e.g., "18:00"
    
    services = relationship("BarberService", back_populates="barber", cascade="all, delete-orphan")
    appointments = relationship("Appointment", back_populates="barber")

class BarberService(Base):
    """Services offered by a specific barber"""
    __tablename__ = "barber_services"

    id = Column(Integer, primary_key=True, index=True)
    barber_id = Column(Integer, ForeignKey("barbers.id", ondelete="CASCADE"), nullable=False)
    name = Column(String, index=True, nullable=False)
    duration_minutes = Column(Integer, nullable=False)
    price = Column(Float, nullable=False)  # Original price
    discount_price = Column(Float, nullable=True)  # Discounted price (optional)
    
    barber = relationship("Barber", back_populates="services")

# Keep Service for backwards compatibility / global services if needed
class Service(Base):
    __tablename__ = "services"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    duration_minutes = Column(Integer)
    price = Column(String)  # Legacy: string format

class Customer(Base):
    """Customer profile with authentication"""
    __tablename__ = "customers"
    
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True, nullable=False)
    phone = Column(String, unique=True, index=True, nullable=False)
    email = Column(String, unique=True, index=True, nullable=True)
    hashed_password = Column(String, nullable=False)
    avatar_url = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    
    appointments = relationship("Appointment", back_populates="customer")

class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True, index=True)
    customer_name = Column(String, index=True)
    customer_phone = Column(String)
    customer_id = Column(Integer, ForeignKey("customers.id"), nullable=True)
    barber_id = Column(Integer, ForeignKey("barbers.id"), nullable=True)
    barber_service_id = Column(Integer, ForeignKey("barber_services.id"), nullable=True)
    service_id = Column(Integer, ForeignKey("services.id"), nullable=True)  # Legacy
    start_time = Column(DateTime)
    end_time = Column(DateTime)
    status = Column(String, default="scheduled")  # scheduled, completed, no_show
    
    customer = relationship("Customer", back_populates="appointments")
    barber = relationship("Barber", back_populates="appointments")
    barber_service = relationship("BarberService")
    service = relationship("Service")  # Legacy
    media = relationship("AppointmentMedia", back_populates="appointment", cascade="all, delete-orphan")

class AppointmentMedia(Base):
    """Photos/videos from haircuts - stories style, expire in 7 days"""
    __tablename__ = "appointment_media"
    
    id = Column(Integer, primary_key=True, index=True)
    appointment_id = Column(Integer, ForeignKey("appointments.id", ondelete="CASCADE"), nullable=False)
    media_url = Column(String, nullable=False)
    media_type = Column(String, default="image")  # image or video
    created_at = Column(DateTime, default=datetime.utcnow)
    
    appointment = relationship("Appointment", back_populates="media")
