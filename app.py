from flask import Flask, render_template, g, request, redirect, url_for
from flask_cors import CORS
from database import engine, Base, SessionLocal, init_db
import os

# Create tables
Base.metadata.create_all(bind=engine)

app = Flask(__name__)

# Basic Config
app.secret_key = os.getenv("SECRET_KEY", "INSECURE-DEFAULT-KEY-CHANGE-IN-PRODUCTION")
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024 # 100MB max upload

# CORS
# Example: ALLOWED_ORIGINS=https://mybarbershop.com,https://admin.mybarbershop.com
allowed_origins = os.getenv("ALLOWED_ORIGINS", "*").split(",")
CORS(app, resources={r"/*": {"origins": allowed_origins}}, supports_credentials=True)

# Database Setup
init_db(app)

# Helper to get DB in routes (if not using g directly via some other middleware)
def get_db_session():
    if 'db' not in g:
        g.db = SessionLocal()
    return g.db

# Register Blueprints (Imports inside to avoid circular deps if any)
from routers.auth import auth_bp
from routers.admin import admin_bp
from routers.user import user_bp
from routers.customer import customer_bp
from routers.upload import upload_bp
from routers.stories import stories_bp

app.register_blueprint(auth_bp)
app.register_blueprint(admin_bp)
app.register_blueprint(user_bp)
app.register_blueprint(customer_bp)
app.register_blueprint(upload_bp)
app.register_blueprint(stories_bp)


@app.route("/")
def read_root():
    return render_template("index.html")

@app.route("/login")
def read_login():
    return render_template("login.html")

@app.route("/panel")
def read_admin():
    token = request.cookies.get("access_token")
    if not token:
        return redirect(url_for('read_login'))
    return render_template("admin.html")

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=8000)
