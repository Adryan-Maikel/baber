from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.middleware.cors import CORSMiddleware
from database import engine, Base
from routers import admin, user, auth
import models
import os

# Create tables
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Barbershop API")

# CORS - Configure via environment variable for production
# Example: ALLOWED_ORIGINS=https://mybarbershop.com,https://admin.mybarbershop.com
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Static Files
app.mount("/static", StaticFiles(directory="static"), name="static")

# Templates
templates = Jinja2Templates(directory="templates")

# Routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(user.router)

@app.get("/")
def read_root(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})

@app.get("/login")
def read_login(request: Request):
    return templates.TemplateResponse("login.html", {"request": request})

@app.get("/admin")
def read_admin(request: Request):
    return templates.TemplateResponse("admin.html", {"request": request})
