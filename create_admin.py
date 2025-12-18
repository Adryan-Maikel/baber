"""
Script para criar o usuário admin inicial
"""
from database import SessionLocal
from models import User
import bcrypt

def create_admin():
    db = SessionLocal()
    try:
        # Verificar se já existe um usuário
        existing_user = db.query(User).filter(User.username == "admin").first()
        if existing_user:
            print("❌ Usuário 'admin' já existe!")
            return
        
        # Criar usuário admin
        pwd_bytes = "admin123".encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
        admin_user = User(
            username="admin",
            hashed_password=hashed_password,
            is_admin=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("✅ Usuário admin criado com sucesso!")
        print(f"   Username: admin")
        print(f"   Password: admin123")
        print(f"   ID: {admin_user.id}")
        
    except Exception as e:
        print(f"❌ Erro ao criar usuário: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
