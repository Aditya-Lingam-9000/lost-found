import json
import os
from datetime import datetime
from .text_matching import get_text_score
from .image_matching import get_image_score
from utils.email_service import send_match_email
from services.notification_service import NotificationService

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STORAGE_ROOT = os.environ.get('APP_STORAGE_ROOT', BASE_DIR)
DB_DIR = os.path.join(STORAGE_ROOT, 'database')
os.makedirs(DB_DIR, exist_ok=True)
notification_service = NotificationService(DB_DIR)

def get_next_id(file_path, prefix):
    if not os.path.exists(file_path):
        return f"{prefix}0001"
    with open(file_path, 'r', encoding='utf-8') as f:
        lines = f.readlines()
        if not lines:
            return f"{prefix}0001"
        last_line = lines[-1].strip()
        if last_line:
            try:
                last_record = json.loads(last_line)
                key_name = "match_id" if prefix == "M" else "chat_id"
                last_id = last_record.get(key_name, "")
                if last_id.startswith(prefix):
                    num = int(last_id.replace(prefix, ''))
                    return f"{prefix}{num+1:04d}"
            except json.JSONDecodeError:
                pass
    return f"{prefix}0001"

def run_matching():
    lost_file = os.path.join(DB_DIR, 'lost.txt')
    found_file = os.path.join(DB_DIR, 'found.txt')
    matches_file = os.path.join(DB_DIR, 'matches.txt')
    chats_file = os.path.join(DB_DIR, 'chats.txt')
    
    # Load existing pairs to prevent duplicate matches
    existing_pairs = set()
    if os.path.exists(matches_file):
        with open(matches_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        record = json.loads(line)
                        existing_pairs.add((record['lost_id'], record['found_id']))
                    except json.JSONDecodeError:
                        pass
                        
    lost_items = []
    if os.path.exists(lost_file):
        with open(lost_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        lost_items.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
                        
    found_items = []
    if os.path.exists(found_file):
        with open(found_file, 'r', encoding='utf-8') as f:
            for line in f:
                if line.strip():
                    try:
                        found_items.append(json.loads(line))
                    except json.JSONDecodeError:
                        pass
                        
    new_matches = []
                    
    for lost in lost_items:
        if lost.get('item_status', 'active') == 'closed':
            continue
        for found in found_items:
            if found.get('item_status', 'active') == 'closed':
                continue
            # Never match the same account's lost/found reports.
            lost_user = str(lost.get('user_id') or '').strip()
            found_user = str(found.get('user_id') or '').strip()
            if lost_user and found_user and lost_user == found_user:
                continue

            pair = (lost.get('lost_id'), found.get('found_id'))
            if not pair[0] or not pair[1] or pair in existing_pairs:
                continue
            
            # ========== ADVANCED FIELD-LEVEL SCORING ==========
            # Score each field separately and apply smart weighting
            from .text_matching import get_field_similarity
            
            lost_name = lost.get('item_name', '').strip()
            found_name = found.get('item_name', '').strip()
            name_score = get_field_similarity(lost_name, found_name, field_name='item_name')
            
            lost_desc = lost.get('description', '').strip()
            found_desc = found.get('description', '').strip()
            desc_score = get_field_similarity(lost_desc, found_desc, field_name='description')
            
            lost_loc = lost.get('location', '').strip()
            found_loc = found.get('location', '').strip()
            loc_score = get_field_similarity(lost_loc, found_loc, field_name='location')
            
            # Field-weighted text score (item_name most important, then description, then location)
            # Weights: 0.50 name + 0.35 desc + 0.15 location
            text_score = (0.50 * name_score) + (0.35 * desc_score) + (0.15 * loc_score)
            
            lost_img = lost.get('image_path')
            found_img = found.get('image_path')
            
            # Combine scores with image verification
            image_score = 0.0
            if lost_img and found_img:
                image_score = get_image_score(lost_img, found_img)
                # With advanced algo, we can trust both equally
                # 55% image (visual verification is strongest), 45% text (semantic match)
                final_score = (0.55 * image_score) + (0.45 * text_score)
            else:
                # If an image is missing, rely on text with slight penalty
                # Only count if text score is strong enough (>0.50 to warrant a match)
                final_score = text_score * 0.85  # Penalty for missing image
                
            # ========== INTELLIGENT THRESHOLD LOGIC ==========
            # High confidence match (both images strong): 0.65
            # Medium confidence (image good + text okay): 0.60
            # Text-only (no images): 0.55
            
            if lost_img and found_img:
                threshold = 0.65  # Both images present = strict threshold
            elif image_score > 0.75:  # Image was good but one might be missing
                threshold = 0.60
            else:
                threshold = 0.55  # Text-only or weak image
            
            if final_score >= threshold:
                
                # Check 75% threshold specifically for email notifications
                if final_score > 0.75:
                    if lost.get('user_email'):
                        send_match_email(lost.get('user_email'), lost.get('item_name'), round(final_score * 100))
                    if found.get('user_email'):
                        send_match_email(found.get('user_email'), found.get('item_name'), round(final_score * 100))
                
                match_id = f"{'M'}{len(existing_pairs)+1:04d}" # get_next_id(matches_file, 'M')
                chat_id = get_next_id(chats_file, 'C')
                
                verification_profile = found.get('verification_profile', {}) or {}
                required_keys = [
                    'verify_item_type',
                    'verify_color',
                    'verify_unique_mark',
                    'verify_inside_contents',
                    'verify_found_spot'
                ]
                verification_required = all(str(verification_profile.get(k, '')).strip() for k in required_keys)

                match_record = {
                    "match_id": match_id,
                    "lost_id": pair[0],
                    "found_id": pair[1],
                    "score": round(final_score, 2),
                    "status": "pending",
                    "verification_required": verification_required,
                    "verification_status": "pending_questions" if verification_required else "not_required",
                    "created_at": datetime.utcnow().isoformat() + "Z",
                    "chat_id": chat_id
                }
                
                chat_record = {
                    "chat_id": chat_id,
                    "user1_id": lost.get('user_id'),
                    "user2_id": found.get('user_id'),
                    "match_id": match_id,
                    "created_at": match_record["created_at"]
                }
                
                # Append records
                with open(matches_file, 'a', encoding='utf-8') as f:
                    f.write(json.dumps(match_record) + "\n")

                try:
                    notification_service.create_match_notifications(match_record, lost, found)
                except Exception as notification_error:
                    print(f"Warning: failed to create notifications for {match_id}: {notification_error}")
                
                with open(chats_file, 'a', encoding='utf-8') as f:
                    f.write(json.dumps(chat_record) + "\n")
                    
                existing_pairs.add(pair)
                new_matches.append(match_record)
                
    return new_matches
