from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, List
from datetime import datetime
import re

# User/Auth Schemas
class UserCreate(BaseModel):
    username: str
    password: str
    is_admin: bool = False

class User(BaseModel):
    id: int
    username: str
    is_admin: bool
    
    class Config:
        from_attributes = True

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    role: str = "admin"
    role: str = "admin"

class TokenData(BaseModel):
    username: Optional[str] = None

# =============== Barber Service Schemas ===============

class BarberServiceBase(BaseModel):
    name: str
    duration_minutes: int
    price: float
    discount_price: Optional[float] = None
    
    @model_validator(mode='after')
    def validate_discount(self):
        if self.discount_price is not None and self.discount_price > self.price:
            raise ValueError('Preço com desconto não pode ser maior que o preço original')
        return self

class BarberServiceCreate(BarberServiceBase):
    pass

class BarberServiceUpdate(BaseModel):
    name: Optional[str] = None
    duration_minutes: Optional[int] = None
    price: Optional[float] = None
    discount_price: Optional[float] = None

class BarberService(BarberServiceBase):
    id: int
    barber_id: int
    
    class Config:
        from_attributes = True

# =============== Barber Schemas ===============

class BarberBase(BaseModel):
    name: str
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: bool = True
    start_time: str = "09:00"
    end_time: str = "18:00"
    start_interval: Optional[str] = None
    end_interval: Optional[str] = None
    username: Optional[str] = None

class BarberCreate(BarberBase):
    password: Optional[str] = None

class BarberUpdate(BaseModel):
    name: Optional[str] = None
    username: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    start_interval: Optional[str] = None
    end_interval: Optional[str] = None

class Barber(BarberBase):
    id: int
    services: List[BarberService] = []
    
    class Config:
        from_attributes = True

class BarberSimple(BarberBase):
    """Barber without services list (for listings)"""
    id: int
    
    class Config:
        from_attributes = True

# =============== Legacy Service Schemas (backwards compat) ===============

class ServiceBase(BaseModel):
    name: str
    duration_minutes: int
    price: str

class ServiceCreate(ServiceBase):
    pass

class Service(ServiceBase):
    id: int
    class Config:
        from_attributes = True

# =============== Phone Validation Helper ===============

def validate_brazilian_phone(phone: str) -> str:
    """Validate and normalize Brazilian phone number"""
    digits = re.sub(r'\D', '', phone)
    
    if len(digits) < 10 or len(digits) > 11:
        raise ValueError('Telefone deve ter 10 ou 11 dígitos')
    
    if len(digits) == 11:
        return f"({digits[:2]}) {digits[2:7]}-{digits[7:]}"
    else:
        return f"({digits[:2]}) {digits[2:6]}-{digits[6:]}"

# =============== Customer Schemas ===============

class CustomerCreate(BaseModel):
    name: str
    phone: str
    email: Optional[str] = None
    password: str
    
    @field_validator('phone')
    @classmethod
    def validate_phone(cls, v):
        return validate_brazilian_phone(v)

class CustomerLogin(BaseModel):
    phone: str
    password: str

class CustomerUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None

class Customer(BaseModel):
    id: int
    name: str
    phone: str
    email: Optional[str] = None
    
    class Config:
        from_attributes = True

class CustomerToken(BaseModel):
    access_token: str
    token_type: str
    customer: Customer

class AppointmentHistory(BaseModel):
    id: int
    start_time: datetime
    end_time: datetime
    barber_name: Optional[str] = None
    service_name: Optional[str] = None
    barber_id: Optional[int] = None
    barber_service_id: Optional[int] = None
    service_id: Optional[int] = None
    duration_minutes: Optional[int] = None
    service_id: Optional[int] = None
    duration_minutes: Optional[int] = None
    price: Optional[float] = None
    status: str
    rating: Optional[int] = None
    feedback_notes: Optional[str] = None
    media_url: Optional[str] = None
    media_type: Optional[str] = None
    media_type: Optional[str] = None
    barber_avatar: Optional[str] = None
    story_is_public: Optional[bool] = True
    
    class Config:
        from_attributes = True

# =============== Appointment Schemas ===============

class AppointmentBase(BaseModel):
    customer_name: str
    customer_phone: str
    barber_id: int
    barber_service_id: Optional[int] = None
    service_id: Optional[int] = None  # Legacy
    start_time: datetime
    
    @field_validator('customer_phone')
    @classmethod
    def validate_phone(cls, v):
        return validate_brazilian_phone(v)

class AppointmentCreate(AppointmentBase):
    pass

class Appointment(AppointmentBase):
    id: int
    end_time: datetime
    status: str = "scheduled"
    feedback_notes: Optional[str] = None
    rating: Optional[int] = None
    barber: Optional[BarberSimple] = None
    barber_service: Optional[BarberService] = None
    service: Optional[Service] = None  # Legacy
    
    class Config:
        from_attributes = True

# =============== Appointment Media Schemas ===============

class AppointmentMediaBase(BaseModel):
    media_url: str
    media_type: str = "image"  # image or video

class AppointmentMediaCreate(AppointmentMediaBase):
    appointment_id: int

class FeedbackCreate(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    rating: Optional[int] = None
    media_url: Optional[str] = None
    media_type: str = "image"
    is_public: Optional[bool] = True

class AppointmentMedia(AppointmentMediaBase):
    id: int
    appointment_id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

class AppointmentWithMedia(Appointment):
    """Appointment with associated media"""
    media: List[AppointmentMedia] = []
