from flask import Blueprint, request, jsonify, g
from sqlalchemy.orm import Session
from sqlalchemy import func
from datetime import datetime, timedelta
from typing import Optional, List, Dict
import models
from routers.auth import get_db, SECRET_KEY, ALGORITHM
from jose import jwt, JWTError

stories_bp = Blueprint('stories', __name__, url_prefix='/stories')

# Stories are visible for 7 days
STORIES_RETENTION_DAYS = 7

def get_current_customer_optional(db: Session):
    """Get current customer from token (header or query param) or None"""
    token = request.args.get('token')
    if not token:
        auth_header = request.headers.get("Authorization")
        if auth_header:
            token = auth_header.split(" ")[1] if " " in auth_header else auth_header
    
    if not token:
        return None
        
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        sub = payload.get("sub")
        if not sub or not sub.startswith("customer:"):
            return None
        customer_id = int(sub.split(":")[1])
        return db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    except (JWTError, ValueError):
        return None

def get_story_stats(db: Session, media_ids: List[int], current_user_id: Optional[int]):
    """
    Get stats for a list of media IDs.
    Returns:
    {
        media_id: {
            "view_count": int,
            "reaction_counts": {"like": 0, "dislike": 0, "love": 0},
            "user_reaction": str | None
        }
    }
    """
    if not media_ids:
        return {}
        
    # 1. View Counts
    view_counts = db.query(
        models.StoryView.media_id, func.count(models.StoryView.id)
    ).filter(
        models.StoryView.media_id.in_(media_ids)
    ).group_by(models.StoryView.media_id).all()
    
    view_map = {m_id: count for m_id, count in view_counts}
    
    # 2. Reaction Counts
    reaction_rows = db.query(
        models.StoryReaction.media_id, 
        models.StoryReaction.reaction_type,
        func.count(models.StoryReaction.id)
    ).filter(
        models.StoryReaction.media_id.in_(media_ids)
    ).group_by(models.StoryReaction.media_id, models.StoryReaction.reaction_type).all()
    
    reaction_map: Dict[int, Dict[str, int]] = {}
    for m_id, r_type, count in reaction_rows:
        if m_id not in reaction_map:
            reaction_map[m_id] = {"like": 0, "dislike": 0, "love": 0}
        reaction_map[m_id][r_type] = count
        
    # 3. User Reaction (if logged in)
    user_reaction_map = {}
    if current_user_id:
        user_reactions = db.query(
            models.StoryReaction.media_id, models.StoryReaction.reaction_type
        ).filter(
            models.StoryReaction.media_id.in_(media_ids),
            models.StoryReaction.user_id == current_user_id
        ).all()
        user_reaction_map = {m_id: r_type for m_id, r_type in user_reactions}
        
    # Combine results
    stats = {}
    for mid in media_ids:
        stats[mid] = {
            "view_count": view_map.get(mid, 0),
            "reaction_counts": reaction_map.get(mid, {"like": 0, "dislike": 0, "love": 0}),
            "user_reaction": user_reaction_map.get(mid, None)
        }
    return stats


@stories_bp.route("", methods=["GET"])
def get_all_stories():
    """Get all stories (media from last 7 days) grouped by barber"""
    db = get_db()
    current_user = get_current_customer_optional(db)
    current_user_id = current_user.id if current_user else None
    
    cutoff_date = datetime.utcnow() - timedelta(days=STORIES_RETENTION_DAYS)
    
    media_list = db.query(models.AppointmentMedia).join(
        models.Appointment
    ).filter(
        models.AppointmentMedia.created_at >= cutoff_date,
        models.AppointmentMedia.is_public == True
    ).order_by(
        models.AppointmentMedia.created_at.desc()
    ).all()
    
    # Get stats
    media_ids = [m.id for m in media_list]
    stats = get_story_stats(db, media_ids, current_user_id)
    
    # Group by barber
    barber_stories = {}
    for media in media_list:
        appointment = media.appointment
        if not appointment or not appointment.barber:
            continue
            
        barber = appointment.barber
        if barber.id not in barber_stories:
            barber_stories[barber.id] = {
                "barber_id": barber.id,
                "barber_name": barber.name,
                "barber_avatar": barber.avatar_url,
                "stories": []
            }
        
        s_stats = stats.get(media.id, {"view_count": 0, "reaction_counts": {}, "user_reaction": None})
        
        barber_stories[barber.id]["stories"].append({
            "id": media.id,
            "media_url": media.media_url,
            "media_type": media.media_type,
            "created_at": media.created_at.isoformat(),
            "customer_name": appointment.customer_name,
            "service_name": appointment.barber_service.name if appointment.barber_service else None,
            "rating": appointment.rating,
            "feedback": appointment.feedback_notes,
            "view_count": s_stats["view_count"],
            "reaction_counts": s_stats["reaction_counts"],
            "user_reaction": s_stats["user_reaction"]
        })
    
    return jsonify(list(barber_stories.values()))


@stories_bp.route("/<int:story_id>/view", methods=["POST"])
def view_story(story_id):
    """Record a view for a story"""
    db = get_db()
    current_user = get_current_customer_optional(db)
    user_id = current_user.id if current_user else None
    ip_address = request.remote_addr
    
    # Check if story exists
    media = db.query(models.AppointmentMedia).filter(models.AppointmentMedia.id == story_id).first()
    if not media:
        return jsonify({"error": "Story not found"}), 404
        
    # Check duplicate view
    # Logic: 
    # - If logged in: Check by user_id
    # - If guest: Check by ip_address (and user_id is null)
    # Allows a user to view again if they login/logout properly, but let's keep it simple.
    # The requirement said "users can view multiple times" -> "uma pessoa também pode visualizar mais de uma vez"
    # Wait, the user said "uma pessoa também pode visualizar mais de uma vez" but usually view COUNTING counts unique people or total views?
    # Usually "views" counts distinct eyes, but some platforms count loops.
    # Let's record EVERY view event but unique constraint?
    # If I record EVERY view, table grows fast.
    # User comment: "user se logado se não IP, uma pessoa também pode visualizar mais de uma vez."
    # This implies we should ALLOW duplicate views? Or maybe just track them?
    # Let's just INSERT always. Then Count is total views.
    # But for "People saw", we do distinct count in query.
    
    # I will allow ONE view record per User/IP per Session? 
    # Or just simpler: insert if not exists today?
    # Let's just Insert. Total views.
    
    # However, to avoid SPAM abuse (refresh spam), I might want to limit it?
    # Let's check if we already viewed RECENTLY (e.g. last 1 hour?) logic or just simple:
    
    # Going with: Insert always.
    
    new_view = models.StoryView(
        media_id=story_id,
        user_id=user_id,
        ip_address=ip_address
    )
    db.add(new_view)
    db.commit()
    
    return jsonify({"success": True})


@stories_bp.route("/<int:story_id>/react", methods=["POST"])
def react_story(story_id):
    """React to a story (toggle)"""
    db = get_db()
    current_user = get_current_customer_optional(db)
    if not current_user:
        return jsonify({"error": "Precisa estar logado para reagir"}), 401
        
    data = request.json
    reaction_type = data.get("reaction")
    if reaction_type not in ["like", "dislike", "love"]:
        return jsonify({"error": "Reação inválida"}), 400
        
    media = db.query(models.AppointmentMedia).filter(models.AppointmentMedia.id == story_id).first()
    if not media:
        return jsonify({"error": "Story not found"}), 404
        
    # Check for existing reaction
    existing = db.query(models.StoryReaction).filter(
        models.StoryReaction.media_id == story_id,
        models.StoryReaction.user_id == current_user.id
    ).first()
    
    action = "added"
    
    if existing:
        if existing.reaction_type == reaction_type:
            # Toggle OFF
            db.delete(existing)
            action = "removed"
        else:
            # Change reaction
            existing.reaction_type = reaction_type
            action = "updated"
    else:
        # Create new
        new_reaction = models.StoryReaction(
            media_id=story_id,
            user_id=current_user.id,
            reaction_type=reaction_type
        )
        db.add(new_reaction)
        
    db.commit()
    
    return jsonify({"success": True, "action": action, "reaction": reaction_type})

