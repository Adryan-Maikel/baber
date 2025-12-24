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



# Context Processor for Theme
@app.context_processor
def inject_theme():
    """Inject theme variables into all templates"""
    from models import ThemeConfig
    
    # Helper to hex -> rgb
    def hex_to_rgb(hex_color):
        if not hex_color: return (0,0,0)
        hex_color = hex_color.lstrip('#')
        try:
            return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))
        except:
            return (0,0,0)
        
    db = SessionLocal()
    try:
        config = db.query(ThemeConfig).first()
        if not config:
            # Create default if missing
            config = ThemeConfig()
            db.add(config)
            db.commit()
            db.refresh(config)
            
        # Convert accents/shadows to RGB for opacity vars
        accent_rgb = ",".join(map(str, hex_to_rgb(config.accent_color)))
        danger_rgb = ",".join(map(str, hex_to_rgb(config.danger_color)))
        # Shadow roughly black or dark
        shadow_rgb = "0, 0, 0" 
        
        theme_css = f"""
        <style>
            :root {{
                --bg-color: {config.bg_color};
                --bg-secondary: {config.bg_secondary};
                --card-bg: {config.card_bg};
                --card-hover: {config.card_hover};
                
                --text-primary: {config.text_primary};
                --text-secondary: {config.text_secondary};
                
                --accent: {config.accent_color};
                --accent-hover: {config.accent_hover};
                --accent-rgb: {accent_rgb};
                --accent-light: rgba({accent_rgb}, 0.15);
                
                --danger: {config.danger_color};
                --danger-rgb: {danger_rgb};
                
                --success: {config.success_color};
                
                --border: {config.border_color};
                
                --star-color: {config.star_color};
                --whatsapp-color: {config.whatsapp_color};
            }}
        </style>
        """
        return dict(theme_css=theme_css, theme_config=config)
    except Exception as e:
        print(f"Error loading theme: {e}")
        return dict(theme_css="", theme_config=None)
    finally:
        db.close()

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
