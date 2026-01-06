"""
Script para criar o usuário admin inicial
"""
from database import SessionLocal, engine, Base
from models import User
import bcrypt
import getpass

def create_admin():
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    try:
        print("=== Criar Usuário Admin ===")
        username = input("Digite o nome de usuário (default: admin): ").strip()
        if not username:
            username = "admin"
            print(f"Usando nome de usuário: {username}")
        
        password = getpass.getpass("Digite a senha: ").strip()
        if not password:
            print("❌ A senha não pode ser vazia.")
            return

        confirm_password = getpass.getpass("Confirme a senha: ").strip()
        if password != confirm_password:
            print("❌ As senhas não coincidem.")
            return

        # Verificar se já existe um usuário com este nome
        existing_user = db.query(User).filter(User.username == username).first()
        if existing_user:
            print(f"❌ O usuário '{username}' já existe!")
            return
        
        # Criar usuário admin
        pwd_bytes = password.encode('utf-8')
        salt = bcrypt.gensalt()
        hashed_password = bcrypt.hashpw(pwd_bytes, salt).decode('utf-8')
        
        admin_user = User(
            username=username,
            hashed_password=hashed_password,
            is_admin=True
        )
        db.add(admin_user)
        db.commit()
        db.refresh(admin_user)
        
        print("\n✅ Usuário admin criado com sucesso!")
        print(f"   Username: {admin_user.username}")
        print(f"   ID: {admin_user.id}")
        
    except Exception as e:
        print(f"❌ Erro ao criar usuário: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_admin()
