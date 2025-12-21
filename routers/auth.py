from flask import Blueprint, request, jsonify, make_response, g, current_app, Response
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from typing import Optional
from jose import jwt, JWTError
import bcrypt
import os
import warnings
import models, schemas
from database import SessionLocal

auth_bp = Blueprint('auth', __name__, url_prefix='/auth')

# Security configurations
SECRET_KEY = os.getenv("SECRET_KEY", "INSECURE-DEFAULT-KEY-CHANGE-IN-PRODUCTION")
if "INSECURE" in SECRET_KEY:
    warnings.warn("⚠️  Usando SECRET_KEY padrão! Configure a variável de ambiente SECRET_KEY para produção.", UserWarning)
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))  # 24 hours default

# Rate limiting configuration
RATE_LIMIT_DELAYS = [0, 0, 5, 30, 60, 120]  # seconds per attempt count

def get_db():
    if 'db' not in g:
        g.db = SessionLocal()
    return g.db

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
    if not hashed_password:
        return False
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


def get_current_user(token: Optional[str] = None):
    """Get the current authenticated user (Admin or Barber) from token"""
    db = get_db()
    
    # If not provided explicit, try cookie
    if not token:
        cookie_header = request.cookies.get("access_token")
        if cookie_header and cookie_header.startswith("Bearer "):
            token = cookie_header.split(" ")[1]
        elif cookie_header:
             token = cookie_header
    
    if not token:
        return None
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        role: str = payload.get("role", "admin")  # Default to admin for legacy tokens
        if username is None:
            return None
    except JWTError:
        return None
    
    if role == "barber":
        user = db.query(models.Barber).filter(models.Barber.username == username).first()
    else:
        user = db.query(models.User).filter(models.User.username == username).first()
        
    if user is None:
        return None
        
    # Attach role to user object temporary for permission checks
    user.role = role
    return user


def get_current_admin_user():
    """Ensure the current user is an admin"""
    current_user = get_current_user()
    if not current_user:
        return None
    
    if getattr(current_user, "role", "admin") != "admin":
        return None
        
    if hasattr(current_user, "is_admin") and not current_user.is_admin:
        return None
        
    return current_user

def get_current_panel_user():
    """Ensure the current user is authorized for panel (Admin or Barber)"""
    return get_current_user()


@auth_bp.route("/login", methods=["POST"])
def login():
    """Login endpoint with rate limiting"""
    db = get_db()
    
    # Get form data (support both JSON and Form Data)
    if request.is_json:
        data = request.json
        username = data.get("username")
        password = data.get("password")
    else:
        username = request.form.get("username")
        password = request.form.get("password")

    if not username or not password:
         return jsonify({"detail": "Username and password required"}), 400

    # Use IP address as identifier for rate limiting
    client_ip = request.remote_addr or "unknown"
    identifier = f"{client_ip}:{username}"
    
    # Check rate limit
    wait_time = check_rate_limit(db, identifier)
    if wait_time:
        resp = jsonify({"detail": f"Muitas tentativas. Aguarde {wait_time} segundos."})
        resp.headers["Retry-After"] = str(wait_time)
        return resp, 429
    
    user, role = authenticate_user(db, username, password)
    if not user:
        # Record failed attempt
        delay = record_failed_attempt(db, identifier)
        detail = "Usuário ou senha incorretos"
        if delay > 0:
            detail += f". Aguarde {delay} segundos para tentar novamente."
        return jsonify({"detail": detail}), 401
    
    # Clear failed attempts on success
    clear_failed_attempts(db, identifier)
    
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": role, "id": user.id}, 
        expires_delta=access_token_expires
    )

    # Return response with cookie
    response = make_response(jsonify({
        "access_token": access_token, 
        "token_type": "bearer", 
        "role": role
    }))
    
    response.set_cookie(
        key="access_token",
        value=f"Bearer {access_token}",
        httponly=True,
        max_age=ACCESS_TOKEN_EXPIRE_MINUTES * 60,
        samesite="Lax",
    )

    return response, 200


@auth_bp.route("/register", methods=["POST"])
def register():
    """Register a new user (admin only in production)"""
    db = get_db()
    
    # Validate Input
    try:
        if request.is_json:
            user_data = schemas.UserCreate(**request.json)
        else:
            # Simple fallback if somehow sent as form, though API expects JSON usually for struct data
            # But let's assume JSON for register
             user_data = schemas.UserCreate(**request.json)
    except Exception as e:
        return jsonify({"detail": str(e)}), 400
        
    # Check if user exists
    db_user = db.query(models.User).filter(models.User.username == user_data.username).first()
    if db_user:
        return jsonify({"detail": "Username already registered"}), 400
    
    # Create new user
    hashed_password = get_password_hash(user_data.password)
    db_user = models.User(
        username=user_data.username,
        hashed_password=hashed_password,
        is_admin=user_data.is_admin
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    return jsonify({
        "id": db_user.id,
        "username": db_user.username,
        "is_admin": db_user.is_admin
    })


@auth_bp.route("/me", methods=["GET"])
def read_users_me():
    """Get current user info"""
    current_user = get_current_user()
    if not current_user:
        return jsonify({"detail": "Not authenticated"}), 401
        
    return jsonify({
        "id": current_user.id,
        "username": current_user.username,
        "is_admin": getattr(current_user, "is_admin", False),
        "role": getattr(current_user, "role", "admin")
    })


@auth_bp.route("/init-admin", methods=["POST"])
def init_admin():
    """Initialize default admin user (only if no users exist)"""
    db = get_db()
    user_count = db.query(models.User).count()
    if user_count > 0:
        return jsonify({"detail": "Admin user already exists"}), 400
    
    hashed_password = get_password_hash("admin123")
    admin_user = models.User(
        username="admin",
        hashed_password=hashed_password,
        is_admin=True
    )
    db.add(admin_user)
    db.commit()
    db.refresh(admin_user)
    return jsonify({"message": "Admin user created successfully", "username": "admin", "password": "admin123"})

@auth_bp.route("/logout", methods=["POST"])
def logout():
    """Logout endpoint to clear auth cookies"""
    response = make_response(jsonify({"message": "Logged out successfully"}))
    response.delete_cookie("access_token")
    return response


