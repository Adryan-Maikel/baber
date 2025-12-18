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

class BarberCreate(BarberBase):
    pass

class BarberUpdate(BaseModel):
    name: Optional[str] = None
    phone: Optional[str] = None
    avatar_url: Optional[str] = None
    is_active: Optional[bool] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None

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
    barber: Optional[BarberSimple] = None
    barber_service: Optional[BarberService] = None
    service: Optional[Service] = None  # Legacy
    
    class Config:
        from_attributes = True
