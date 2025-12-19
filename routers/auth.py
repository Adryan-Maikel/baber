from fastapi import APIRouter, Depends, HTTPException, status, Request, Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
import bcrypt
import os
import warnings
import models, schemas
from database import get_db

router = APIRouter(
    prefix="/auth",
    tags=["auth"]
)

# Security configurations
SECRET_KEY = os.getenv("SECRET_KEY", "INSECURE-DEFAULT-KEY-CHANGE-IN-PRODUCTION")
if "INSECURE" in SECRET_KEY:
    warnings.warn("⚠️  Usando SECRET_KEY padrão! Configure a variável de ambiente SECRET_KEY para produção.", UserWarning)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours default

# Rate limiting configuration
RATE_LIMIT_DELAYS = [0, 0, 5, 30, 60, 120]  # seconds per attempt count

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")


def get_rate_limit_delay(attempts: int) -> int:
    """Get delay in seconds based on attempt count"""
    if attempts < len(RATE_LIMIT_DELAYS):
        return RATE_LIMIT_DELAYS[attempts]
    return RATE_LIMIT_DELAYS[-1]


def check_rate_limit(db: Session, identifier: str) -> Optional[int]:
    """Check if identifier is rate limited. Returns seconds to wait or None if allowed."""
    attempt = db.query(models.LoginAttempt).filter(
        models.LoginAttempt.identifier == identifier
    ).first()
    
    if not attempt:
        return None
    
    if attempt.locked_until and attempt.locked_until > datetime.utcnow():
        remaining = (attempt.locked_until - datetime.utcnow()).total_seconds()
        return int(remaining) + 1
    
    return None


def record_failed_attempt(db: Session, identifier: str):
    """Record a failed login attempt and set lockout if needed"""
    attempt = db.query(models.LoginAttempt).filter(
        models.LoginAttempt.identifier == identifier
    ).first()
    
    if not attempt:
        attempt = models.LoginAttempt(
            identifier=identifier,
            attempts=1,
            last_attempt=datetime.utcnow()
        )
        db.add(attempt)
    else:
        attempt.attempts += 1
        attempt.last_attempt = datetime.utcnow()
    
    # Set lockout based on attempts
    delay = get_rate_limit_delay(attempt.attempts)
    if delay > 0:
        attempt.locked_until = datetime.utcnow() + timedelta(seconds=delay)
    
    db.commit()
    return delay


def clear_failed_attempts(db: Session, identifier: str):
    """Clear failed attempts after successful login"""
    db.query(models.LoginAttempt).filter(
        models.LoginAttempt.identifier == identifier
    ).delete()
    db.commit()


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify a plain password against a hashed password"""
    password_byte_enc = plain_password.encode('utf-8')
    hashed_password_byte_enc = hashed_password.encode('utf-8')
    return bcrypt.checkpw(password_byte_enc, hashed_password_byte_enc)


def get_password_hash(password: str) -> str:
    """Hash a password"""
    pwd_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt()
    hashed_password = bcrypt.hashpw(pwd_bytes, salt)
    return hashed_password.decode('utf-8')


def authenticate_user(db: Session, username: str, password: str):
    """Authenticate a user (Admin or Barber) by username and password"""
    # 1. Try Admin/User
    user = db.query(models.User).filter(models.User.username == username).first()
    if user and verify_password(password, user.hashed_password):
        return user, "admin"
    
    # 2. Try Barber
    barber = db.query(models.Barber).filter(models.Barber.username == username).first()
    if barber and barber.hashed_password and verify_password(password, barber.hashed_password):
        return barber, "barber"
        
    return None, None


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    """Get the current authenticated user (Admin or Barber) from token"""
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role", "admin")  # Default to admin for legacy tokens
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    if role == "barber":
        user = db.query(models.Barber).filter(models.Barber.username == username).first()
    else:
        user = db.query(models.User).filter(models.User.username == username).first()
        
    if user is None:
        raise credentials_exception
        
    # Attach role to user object temporary for permission checks
    user.role = role
    return user


def get_current_admin_user(current_user = Depends(get_current_user)):
    """Ensure the current user is an admin"""
    if getattr(current_user, "role", "admin") != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem acessar este recurso")
    if hasattr(current_user, "is_admin") and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return current_user

def get_current_panel_user(current_user = Depends(get_current_user)):
    """Ensure the current user is authorized for panel (Admin or Barber)"""
    return current_user


@router.post("/login", response_model=schemas.Token)
async def login(
    request: Request,
    response: Response,
    form_data: OAuth2PasswordRequestForm = Depends(), 
    db: Session = Depends(get_db)
):
    """Login endpoint with rate limiting"""
    # Use IP address as identifier for rate limiting
    client_ip = request.client.host if request.client else "unknown"
    identifier = f"{client_ip}:{form_data.username}"
    
    # Check rate limit
    wait_time = check_rate_limit(db, identifier)
    if wait_time:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Muitas tentativas. Aguarde {wait_time} segundos.",
            headers={"Retry-After": str(wait_time)}
        )
    
    user, role = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        # Record failed attempt
        delay = record_failed_attempt(db, identifier)
        detail = "Usuário ou senha incorretos"
        if delay > 0:
            detail += f". Aguarde {delay} segundos para tentar novamente."
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=detail,
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    # Clear failed attempts on success
    clear_failed_attempts(db, identifier)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": role, "id": user.id}, 
        expires_delta=access_token_expires
    )

    # Set cookie for server-side auth
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="lax",
    )

    return {"access_token": access_token, "token_type": "bearer", "role": role}


@router.post("/register", response_model=schemas.User)
async def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    """Register a new user (admin only in production)"""
    # Check if user exists
    db_user = db.query(models.User).filter(models.User.username == user.username).first()
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    # Create new user
    hashed_password = get_password_hash(user.password)
    db_user = models.User(
        username=user.username,
        hashed_password=hashed_password,
        is_admin=user.is_admin
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


@router.get("/me", response_model=schemas.User)
async def read_users_me(current_user: models.User = Depends(get_current_user)):
    """Get current user info"""
    return current_user


@router.post("/init-admin")
async def init_admin(db: Session = Depends(get_db)):
    """Initialize default admin user (only if no users exist)"""
    user_count = db.query(models.User).count()
    if user_count > 0:
        raise HTTPException(status_code=400, detail="Admin user already exists")
    
    hashed_password = get_password_hash("admin123")
    admin_user = models.User(
        username="admin",
        hashed_password=hashed_password,
        is_admin=True
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    return {"message": "Admin user created successfully", "username": "admin", "password": "admin123"}

@router.post("/logout")
async def logout(response: Response):
    """Logout endpoint to clear auth cookies"""
    response.delete_cookie("access_token")
    return {"message": "Logged out successfully"}
