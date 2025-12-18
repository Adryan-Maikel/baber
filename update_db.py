import sqlite3

def update_db():
    conn = sqlite3.connect('barbershop.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE barbers ADD COLUMN start_interval VARCHAR")
        print("Added start_interval column")
    except Exception as e:
        print(f"Error adding start_interval: {e}")

    try:
        cursor.execute("ALTER TABLE barbers ADD COLUMN end_interval VARCHAR")
        print("Added end_interval column")
    except Exception as e:
        print(f"Error adding end_interval: {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    update_db()
