import sqlite3

def update_db():
    conn = sqlite3.connect('barbershop.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE barbers ADD COLUMN username VARCHAR")
        cursor.execute("CREATE UNIQUE INDEX ix_barbers_username ON barbers (username)")
        print("Added username column")
    except Exception as e:
        print(f"Error adding username: {e}")

    try:
        cursor.execute("ALTER TABLE barbers ADD COLUMN hashed_password VARCHAR")
        print("Added hashed_password column")
    except Exception as e:
        print(f"Error adding hashed_password: {e}")

    try:
        cursor.execute("ALTER TABLE appointments ADD COLUMN feedback_notes VARCHAR")
        print("Added feedback_notes column")
    except Exception as e:
        print(f"Error adding feedback_notes: {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    update_db()
