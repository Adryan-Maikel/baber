from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

# Service Schemas
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

# Schedule Schemas
class ScheduleBase(BaseModel):
    day_of_week: str
    start_time: str
    end_time: str
    is_active: bool = True

class ScheduleCreate(ScheduleBase):
    pass

class Schedule(ScheduleBase):
    id: int
    class Config:
        from_attributes = True

# Appointment Schemas
class AppointmentBase(BaseModel):
    customer_name: str
    customer_phone: str
    service_id: int
    start_time: datetime

class AppointmentCreate(AppointmentBase):
    pass # End time calculated on backend

class Appointment(AppointmentBase):
    id: int
    end_time: datetime
    service: Service
    
    class Config:
        from_attributes = True
