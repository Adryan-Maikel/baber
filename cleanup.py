"""
Cleanup script for expired appointment media.
Run this via cron or Windows Task Scheduler to cleanup media older than 7 days.

Usage:
    python cleanup.py

Schedule recommendation:
    - Run daily at midnight
    - Linux: 0 0 * * * cd /path/to/app && python cleanup.py
    - Windows Task Scheduler: Create basic task to run daily
"""

import os
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from database import SessionLocal
import models

# Media files older than this will be deleted
RETENTION_DAYS = 7

def cleanup_expired_media():
    """Delete media files and database records older than RETENTION_DAYS"""
    db: Session = SessionLocal()
    
    try:
        cutoff_date = datetime.utcnow() - timedelta(days=RETENTION_DAYS)
        
        # Find expired media
        expired_media = db.query(models.AppointmentMedia).filter(
            models.AppointmentMedia.created_at < cutoff_date
        ).all()
        
        deleted_count = 0
        errors = []
        
        for media in expired_media:
            # Delete file from disk
            file_path = os.path.join(os.path.dirname(__file__), media.media_url.lstrip("/"))
            if os.path.exists(file_path):
                try:
                    os.remove(file_path)
                    print(f"Deleted file: {file_path}")
                except OSError as e:
                    errors.append(f"Error deleting {file_path}: {e}")
            
            # Delete from database
            db.delete(media)
            deleted_count += 1
        
        db.commit()
        
        print(f"\n=== Cleanup Summary ===")
        print(f"Deleted {deleted_count} expired media records")
        print(f"Cutoff date: {cutoff_date.isoformat()}")
        
        if errors:
            print(f"\nErrors ({len(errors)}):")
            for error in errors:
                print(f"  - {error}")
        
    finally:
        db.close()


def cleanup_orphan_files():
    """Find and delete files in uploads that have no database record"""
    db: Session = SessionLocal()
    uploads_dir = os.path.join(os.path.dirname(__file__), "static", "uploads", "appointments")
    
    try:
        # Get all media URLs from database
        all_media = db.query(models.AppointmentMedia.media_url).all()
        db_files = {os.path.basename(m.media_url) for m in all_media}
        
        # Check files on disk
        orphan_count = 0
        if os.path.exists(uploads_dir):
            for filename in os.listdir(uploads_dir):
                if filename not in db_files:
                    file_path = os.path.join(uploads_dir, filename)
                    # Only delete if file is older than retention period
                    if os.path.isfile(file_path):
                        file_age = datetime.now() - datetime.fromtimestamp(os.path.getmtime(file_path))
                        if file_age.days > RETENTION_DAYS:
                            try:
                                os.remove(file_path)
                                print(f"Deleted orphan file: {filename}")
                                orphan_count += 1
                            except OSError as e:
                                print(f"Error deleting orphan {filename}: {e}")
        
        print(f"\nDeleted {orphan_count} orphan files")
        
    finally:
        db.close()


if __name__ == "__main__":
    print(f"Starting media cleanup at {datetime.now().isoformat()}")
    print(f"Retention period: {RETENTION_DAYS} days\n")
    
    cleanup_expired_media()
    cleanup_orphan_files()
    
    print(f"\nCleanup completed at {datetime.now().isoformat()}")
