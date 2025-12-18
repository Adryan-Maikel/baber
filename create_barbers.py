"""
Script para adicionar barbeiros de exemplo ao banco de dados.
Execute: python create_barbers.py
"""
from database import SessionLocal, engine
import models

# Ensure tables exist
models.Base.metadata.create_all(bind=engine)

def create_barbers():
    db = SessionLocal()
    
    # Check if barbers already exist
    existing = db.query(models.Barber).count()
    if existing > 0:
        print(f"Já existem {existing} barbeiros cadastrados.")
        db.close()
        return
    
    # Create sample barbers
    barbers = [
        models.Barber(name="Carlos Silva", phone="(11) 99999-1111", is_active=True),
        models.Barber(name="João Santos", phone="(11) 99999-2222", is_active=True),
        models.Barber(name="Pedro Lima", phone="(11) 99999-3333", is_active=True),
    ]
    
    for barber in barbers:
        db.add(barber)
    
    db.commit()
    print(f"Criados {len(barbers)} barbeiros:")
    for b in barbers:
        print(f"   - {b.name}")
    
    db.close()

if __name__ == "__main__":
    create_barbers()
