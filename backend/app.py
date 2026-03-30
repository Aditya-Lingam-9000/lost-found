import os
import json
from datetime import datetime
from datetime import timedelta
import hashlib
import secrets
import difflib
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename
from ai.matcher import run_matching
from ai.text_matching import get_text_score
from services.audit_service import AuditService
from services.incentive_service import IncentiveService
from services.risk_engine import RiskEngine

app = Flask(__name__)
# Enable CORS for React frontend connecting to this backend
CORS(app)

# Structure Setup
BASE_DIR = os.path.dirname(os.path.abspath(__name__))
STORAGE_ROOT = os.environ.get('APP_STORAGE_ROOT', BASE_DIR)
DB_DIR = os.path.join(STORAGE_ROOT, 'database')
UPLOAD_DIR = os.path.join(STORAGE_ROOT, 'static', 'uploads')
LOST_DIR = os.path.join(UPLOAD_DIR, 'lost')
FOUND_DIR = os.path.join(UPLOAD_DIR, 'found')

os.makedirs(LOST_DIR, exist_ok=True)
os.makedirs(FOUND_DIR, exist_ok=True)
os.makedirs(DB_DIR, exist_ok=True)

audit_service = AuditService(DB_DIR)
incentive_service = IncentiveService(DB_DIR)
risk_engine = RiskEngine(DB_DIR)

HIGH_VALUE_KEYWORDS = {
    "wallet", "laptop", "phone", "mobile", "watch", "tablet", "id", "idcard",
    "airpods", "earbuds", "headphones", "passport", "license", "keys"
}

VERIFICATION_FIELDS = [
    ("verify_item_type", "Item Type", True),
    ("verify_color", "Primary Color", True),
    ("verify_unique_mark", "Unique Mark / Sticker", True),
    ("verify_inside_contents", "Inside Contents", True),
    ("verify_found_spot", "Exact Spot Found", True),
    ("verify_optional_1", "Optional Detail 1", False),
    ("verify_optional_2", "Optional Detail 2", False),
]


def classify_item_priority(item_name, description):
    haystack = f"{item_name} {description}".lower()
    if any(k in haystack for k in {"id", "passport", "license"}):
        return "critical_id"
    if any(k in haystack for k in HIGH_VALUE_KEYWORDS):
        return "high_value"
    return "normal"


def get_reporting_sla_hours(priority):
    if priority == "critical_id":
        return 24
    if priority == "high_value":
        return 72
    return None


def get_finder_user_id_for_match(match_id):
    matches_path = os.path.join(DB_DIR, 'matches.txt')
    found_path = os.path.join(DB_DIR, 'found.txt')
    found_id = None

    if os.path.exists(matches_path):
        with open(matches_path, 'r', encoding='utf-8') as f:
            for line in f:
                if not line.strip():
                    continue
                try:
                    match = json.loads(line)
                    if match.get('match_id') == match_id:
                        found_id = match.get('found_id')
                        break
                except Exception:
                    continue

    if not found_id or not os.path.exists(found_path):
        return None

    with open(found_path, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                found = json.loads(line)
                if found.get('found_id') == found_id:
                    return found.get('user_id')
            except Exception:
                continue
    return None


def hash_token(raw_token):
    return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()


def normalize_text(value):
    return str(value or '').strip().lower()


def get_private_proof_payload(prefix=''):
    return {
        "private_markings": request.form.get(f'{prefix}private_markings', request.form.get('private_markings', '')),
        "inside_contents": request.form.get(f'{prefix}inside_contents', request.form.get('inside_contents', '')),
        "purchase_proof_hint": request.form.get(f'{prefix}purchase_proof_hint', request.form.get('purchase_proof_hint', '')),
        "known_damage_marks": request.form.get(f'{prefix}known_damage_marks', request.form.get('known_damage_marks', '')),
    }


def get_found_verification_profile():
    profile = {}
    for key, _, required in VERIFICATION_FIELDS:
        value = request.form.get(key, '').strip()
        if value:
            profile[key] = value
        elif required:
            profile[key] = ""
    return profile


def hash_recovery_code(raw_code):
    if raw_code is None:
        return None
    code = str(raw_code).strip()
    if not code:
        return None
    return hashlib.sha256(code.encode('utf-8')).hexdigest()


def text_similarity(a, b):
    a_norm = normalize_text(a)
    b_norm = normalize_text(b)
    if not a_norm or not b_norm:
        return 0.0
    if a_norm == b_norm:
        return 1.0

    # Primary scorer: advanced fuzzy/semantic matcher used by the main match engine.
    advanced = get_text_score(a_norm, b_norm)

    # Secondary scorer: fallback lexical alignment for very short phrases.
    seq = difflib.SequenceMatcher(None, a_norm, b_norm).ratio()

    # Blend with a higher weight on the advanced scorer to reduce false borderline cases.
    return min(1.0, (0.8 * advanced) + (0.2 * seq))


def evaluate_verification_answers(expected_profile, provided_answers):
    required_scores = []
    optional_scores = []
    details = {}

    for key, _, required in VERIFICATION_FIELDS:
        expected = expected_profile.get(key, "")
        provided = provided_answers.get(key, "")
        score = text_similarity(expected, provided)
        if expected.strip():
            if required:
                required_scores.append(score)
            else:
                optional_scores.append(score)
            details[key] = round(score, 2)

    if not required_scores:
        return {
            "eligible": False,
            "status": "failed",
            "final_score": 0.0,
            "required_pass_count": 0,
            "required_total": 0,
            "details": details,
            "reason": "verification_profile_missing"
        }

    required_pass_count = sum(1 for s in required_scores if s >= 0.62)
    required_avg = sum(required_scores) / len(required_scores)
    optional_avg = (sum(optional_scores) / len(optional_scores)) if optional_scores else 0.0
    final_score = (0.8 * required_avg) + (0.2 * optional_avg)

    # Accept when at least 3 required answers are good and overall quality is solid.
    if required_pass_count >= 3 and final_score >= 0.55:
        return {
            "eligible": True,
            "status": "verified",
            "final_score": round(final_score, 2),
            "required_pass_count": required_pass_count,
            "required_total": len(required_scores),
            "details": details,
            "reason": "eligible"
        }

    if final_score >= 0.45:
        return {
            "eligible": False,
            "status": "manual_review",
            "final_score": round(final_score, 2),
            "required_pass_count": required_pass_count,
            "required_total": len(required_scores),
            "details": details,
            "reason": "borderline"
        }

    return {
        "eligible": False,
        "status": "failed",
        "final_score": round(final_score, 2),
        "required_pass_count": required_pass_count,
        "required_total": len(required_scores),
        "details": details,
        "reason": "not_eligible"
    }


def load_jsonl_records(filename):
    path = os.path.join(DB_DIR, filename)
    records = []
    if not os.path.exists(path):
        return records
    with open(path, 'r', encoding='utf-8') as f:
        for line in f:
            if not line.strip():
                continue
            try:
                records.append(json.loads(line))
            except Exception:
                continue
    return records


def write_jsonl_records(filename, records):
    path = os.path.join(DB_DIR, filename)
    with open(path, 'w', encoding='utf-8') as f:
        for record in records:
            f.write(json.dumps(record) + "\n")


def append_jsonl_record(filename, record):
    path = os.path.join(DB_DIR, filename)
    with open(path, 'a', encoding='utf-8') as f:
        f.write(json.dumps(record) + "\n")


def find_match_record(match_id):
    for match in load_jsonl_records('matches.txt'):
        if match.get('match_id') == match_id:
            return match
    return None


def find_item_by_id(filename, key, value):
    for item in load_jsonl_records(filename):
        if item.get(key) == value:
            return item
    return None


def get_match_context(match_id):
    match = find_match_record(match_id)
    if not match:
        return None
    lost_item = find_item_by_id('lost.txt', 'lost_id', match.get('lost_id'))
    found_item = find_item_by_id('found.txt', 'found_id', match.get('found_id'))
    if not lost_item or not found_item:
        return None
    return {
        'match': match,
        'lost_item': lost_item,
        'found_item': found_item,
        'owner_user_id': lost_item.get('user_id'),
        'finder_user_id': found_item.get('user_id'),
        'item_priority': found_item.get('item_priority', 'normal')
    }


def update_items_for_match_status(match_id, new_item_status):
    context = get_match_context(match_id)
    if not context:
        return None

    lost_items = load_jsonl_records('lost.txt')
    found_items = load_jsonl_records('found.txt')

    now = datetime.utcnow().isoformat() + 'Z'
    lost_id = context['match'].get('lost_id')
    found_id = context['match'].get('found_id')

    for item in lost_items:
        if item.get('lost_id') == lost_id:
            item['item_status'] = new_item_status
            item['updated_at'] = now
            if new_item_status == 'closed':
                item['resolved_at'] = now
                item['resolved_match_id'] = match_id
            break

    for item in found_items:
        if item.get('found_id') == found_id:
            item['item_status'] = new_item_status
            item['updated_at'] = now
            if new_item_status == 'closed':
                item['resolved_at'] = now
                item['resolved_match_id'] = match_id
            break

    write_jsonl_records('lost.txt', lost_items)
    write_jsonl_records('found.txt', found_items)
    return {'lost_id': lost_id, 'found_id': found_id}


def evaluate_private_answers(expected_private_proof, provided_answers):
    keys = [
        'private_markings',
        'inside_contents',
        'purchase_proof_hint',
        'known_damage_marks'
    ]
    expected_keys = [k for k in keys if normalize_text(expected_private_proof.get(k))]
    if not expected_keys:
        return {
            'pass': False,
            'matched_count': 0,
            'required_count': 0,
            'score': 0.0,
            'reason': 'no_private_proof_configured'
        }

    matched = 0
    for key in expected_keys:
        expected = normalize_text(expected_private_proof.get(key))
        provided = normalize_text(provided_answers.get(key))
        if provided and expected == provided:
            matched += 1

    score = matched / len(expected_keys)
    passed = score >= 0.67 and matched >= 2 if len(expected_keys) >= 2 else score == 1.0
    return {
        'pass': passed,
        'matched_count': matched,
        'required_count': len(expected_keys),
        'score': round(score, 2),
        'reason': 'ok' if passed else 'private_answers_mismatch'
    }


def create_handover_tokens(claim_id, match_id, owner_user_id, finder_user_id):
    owner_token = secrets.token_urlsafe(8)
    finder_token = secrets.token_urlsafe(8)
    token_record = {
        'token_id': get_next_id('TOK', 'handover_tokens.txt'),
        'claim_id': claim_id,
        'match_id': match_id,
        'owner_user_id': owner_user_id,
        'finder_user_id': finder_user_id,
        'owner_token_hash': hash_token(owner_token),
        'finder_token_hash': hash_token(finder_token),
        'status': 'active',
        'expires_at': (datetime.utcnow() + timedelta(hours=24)).isoformat() + 'Z',
        'created_at': datetime.utcnow().isoformat() + 'Z'
    }
    append_jsonl_record('handover_tokens.txt', token_record)
    return token_record, owner_token, finder_token

# Helper to read counter and increment robustly
def get_next_id(prefix, filename):
    file_path = os.path.join(DB_DIR, filename)
    if not os.path.exists(file_path):
        return f"{prefix}0001"
    
    max_count = 0
    with open(file_path, 'r', encoding='utf-8') as f:
        for line in f:
            if line.strip():
                try:
                    item = json.loads(line)
                    # Extract the numeric part of the ID, e.g., '0004' from 'L0004'
                    key_map = {'L': 'lost_id', 'F': 'found_id', 'M': 'match_id', 'C': 'chat_id', 'MSG': 'message_id'}
                    key = key_map.get(prefix, f"{prefix.lower()}_id")
                    item_id = item.get(key, "")
                    if item_id.startswith(prefix):
                        count = int(item_id[len(prefix):])
                        if count > max_count:
                            max_count = count
                except:
                    pass
    return f"{prefix}{str(max_count + 1).zfill(4)}"

@app.route('/', methods=['GET'])
def index():
    return jsonify({"message": "Lost & Found Campus AI System API is running."})


@app.route('/static/uploads/<path:filename>', methods=['GET'])
def serve_uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)

@app.route('/submit_lost', methods=['POST'])
def submit_lost():
    lost_id = get_next_id('L', 'lost.txt')
    
    # Required Fields
    item_name = request.form.get('item_name', 'Unknown Item')
    description = request.form.get('description', '')
    location = request.form.get('location', '')
    date = request.form.get('date', datetime.utcnow().strftime('%Y-%m-%d'))
    user_id = request.form.get('user_id', 'UNKNOWN_USER') # From frontend login state
    user_email = request.form.get('user_email', '') # Added email for notification
    private_proof = get_private_proof_payload()
    recovery_code = request.form.get('verification_code', '').strip()
    
    # Optional Image Handling
    image_path = None
    if 'image' in request.files:
        file = request.files['image']
        if file.filename != '':
            filename = secure_filename(f"{lost_id}_{file.filename}")
            filepath = os.path.join(LOST_DIR, filename)
            file.save(filepath)
            image_path = f"static/uploads/lost/{filename}"

    record = {
        "lost_id": lost_id,
        "user_id": user_id,
        "user_email": user_email,
        "item_name": item_name,
        "description": description,
        "location": location,
        "date": date,
        "private_proof": private_proof,
        "verification_code_hash": hash_recovery_code(recovery_code),
        "item_status": "active",
        "resolved_match_id": None,
        "image_path": image_path,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

    # Append to text database
    with open(os.path.join(DB_DIR, 'lost.txt'), 'a', encoding='utf-8') as f:
        f.write(json.dumps(record) + "\n")
        
    # Auto-run matching in the background/inline after newly lost item
    run_matching()
        
    return jsonify({"success": True, "message": "Lost item safely reported.", "lost_id": lost_id}), 201

@app.route('/submit_found', methods=['POST'])
def submit_found():
    found_id = get_next_id('F', 'found.txt')
    
    # Required Fields
    item_name = request.form.get('item_name', 'Unknown Item')
    description = request.form.get('description', '')
    location = request.form.get('location', '')
    date = request.form.get('date', datetime.utcnow().strftime('%Y-%m-%d'))
    user_id = request.form.get('user_id', 'UNKNOWN_USER') # From frontend login state
    user_email = request.form.get('user_email', '') # Added email for notification
    priority = classify_item_priority(item_name, description)
    sla_hours = get_reporting_sla_hours(priority)
    private_proof = get_private_proof_payload()
    verification_profile = get_found_verification_profile()
    
    # Optional Image Handling
    image_path = None
    if 'image' in request.files:
        file = request.files['image']
        if file.filename != '':
            filename = secure_filename(f"{found_id}_{file.filename}")
            filepath = os.path.join(FOUND_DIR, filename)
            file.save(filepath)
            image_path = f"static/uploads/found/{filename}"

    record = {
        "found_id": found_id,
        "user_id": user_id,
        "user_email": user_email,
        "item_name": item_name,
        "description": description,
        "location": location,
        "date": date,
        "private_proof": private_proof,
        "verification_profile": verification_profile,
        "item_status": "active",
        "resolved_match_id": None,
        "item_priority": priority,
        "reporting_sla_hours": sla_hours,
        "requires_security_review": priority in {"critical_id", "high_value"},
        "report_channel": "standard",
        "image_path": image_path,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

    # Append to text database
    with open(os.path.join(DB_DIR, 'found.txt'), 'a', encoding='utf-8') as f:
        f.write(json.dumps(record) + "\n")
        
    # Auto-run matching in the background/inline after newly found item
    run_matching()

    audit_service.log_event(
        event_type='FOUND_REPORTED',
        actor_id=user_id,
        entity_type='found_item',
        entity_id=found_id,
        metadata={
            'item_priority': priority,
            'requires_security_review': record['requires_security_review'],
            'report_channel': 'standard'
        }
    )
        
    return jsonify({"success": True, "message": "Found item safely reported.", "found_id": found_id}), 201


@app.route('/submit_found_quick', methods=['POST'])
def submit_found_quick():
    found_id = get_next_id('F', 'found.txt')

    item_name = request.form.get('item_name', 'Unknown Item')
    location = request.form.get('location', '')
    description = request.form.get('description', 'Quick report')
    user_id = request.form.get('user_id', 'UNKNOWN_USER')
    user_email = request.form.get('user_email', '')
    date = request.form.get('date', datetime.utcnow().strftime('%Y-%m-%d'))
    private_proof = get_private_proof_payload()
    verification_profile = get_found_verification_profile()

    priority = classify_item_priority(item_name, description)
    sla_hours = get_reporting_sla_hours(priority)

    image_path = None
    if 'image' in request.files:
        file = request.files['image']
        if file and file.filename:
            filename = secure_filename(f"{found_id}_{file.filename}")
            filepath = os.path.join(FOUND_DIR, filename)
            file.save(filepath)
            image_path = f"static/uploads/found/{filename}"

    record = {
        "found_id": found_id,
        "user_id": user_id,
        "user_email": user_email,
        "item_name": item_name,
        "description": description,
        "location": location,
        "date": date,
        "private_proof": private_proof,
        "verification_profile": verification_profile,
        "item_status": "active",
        "resolved_match_id": None,
        "item_priority": priority,
        "reporting_sla_hours": sla_hours,
        "requires_security_review": priority in {"critical_id", "high_value"},
        "report_channel": "quick",
        "image_path": image_path,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

    with open(os.path.join(DB_DIR, 'found.txt'), 'a', encoding='utf-8') as f:
        f.write(json.dumps(record) + "\n")

    run_matching()

    audit_service.log_event(
        event_type='FOUND_QUICK_REPORTED',
        actor_id=user_id,
        entity_type='found_item',
        entity_id=found_id,
        metadata={
            'item_priority': priority,
            'requires_security_review': record['requires_security_review'],
            'report_channel': 'quick'
        }
    )

    return jsonify({
        "success": True,
        "message": "Quick found report submitted.",
        "found_id": found_id,
        "item_priority": priority
    }), 201

@app.route('/match', methods=['POST'])
def trigger_match():
    new_matches = run_matching()
    return jsonify({
        "success": True, 
        "message": f"Matcher finished. Found {len(new_matches)} new matches.",
        "matches": new_matches
    }), 200


@app.route('/match/verification_form', methods=['GET'])
def get_match_verification_form():
    match_id = request.args.get('match_id')
    if not match_id:
        return jsonify({"success": False, "message": "match_id required"}), 400

    context = get_match_context(match_id)
    if not context:
        return jsonify({"success": False, "message": "Match context not found"}), 404

    profile = context['found_item'].get('verification_profile', {})
    questions = []
    for key, label, required in VERIFICATION_FIELDS:
        if profile.get(key, "").strip():
            questions.append({"key": key, "label": label, "required": required})

    return jsonify({
        "success": True,
        "match_id": match_id,
        "verification_required": context['match'].get('verification_required', False),
        "verification_status": context['match'].get('verification_status', 'pending'),
        "owner_user_id": context['owner_user_id'],
        "finder_user_id": context['finder_user_id'],
        "questions": questions
    }), 200


@app.route('/match/verify_answers', methods=['POST'])
def verify_match_answers():
    data = request.json or {}
    match_id = data.get('match_id')
    actor_id = data.get('actor_id')
    answers = data.get('answers', {})

    if not match_id:
        return jsonify({"success": False, "message": "match_id required"}), 400

    context = get_match_context(match_id)
    if not context:
        return jsonify({"success": False, "message": "Match context not found"}), 404

    # Only the lost-item owner can answer verification questions.
    if actor_id != context['owner_user_id']:
        return jsonify({
            "success": False,
            "message": "Only the lost-item owner can submit verification answers."
        }), 403

    expected_profile = context['found_item'].get('verification_profile', {})
    result = evaluate_verification_answers(expected_profile, answers)

    matches = load_jsonl_records('matches.txt')
    updated = False
    for m in matches:
        if m.get('match_id') == match_id:
            m['verification_score'] = result['final_score']
            m['verification_status'] = result['status']
            m['verified_by'] = actor_id
            m['verified_at'] = datetime.utcnow().isoformat() + 'Z'
            updated = True
            break

    if updated:
        write_jsonl_records('matches.txt', matches)

    event_type = 'MATCH_ANSWERS_VERIFIED' if result['eligible'] else 'MATCH_ANSWERS_FAILED'
    audit_service.log_event(
        event_type=event_type,
        actor_id=actor_id,
        entity_type='match',
        entity_id=match_id,
        metadata={
            'status': result['status'],
            'score': result['final_score'],
            'required_pass_count': result['required_pass_count'],
            'required_total': result['required_total']
        }
    )

    if result['eligible']:
        return jsonify({
            "success": True,
            "eligible": True,
            "status": result['status'],
            "score": result['final_score'],
            "message": "You are eligible. Chat and resolution are enabled."
        }), 200

    if result['status'] == 'manual_review':
        return jsonify({
            "success": False,
            "eligible": False,
            "status": result['status'],
            "score": result['final_score'],
            "message": "Borderline result. Admin review required."
        }), 403

    return jsonify({
        "success": False,
        "eligible": False,
        "status": result['status'],
        "score": result['final_score'],
        "message": "You are not eligible to proceed."
    }), 403


@app.route('/match/verify_code', methods=['POST'])
def verify_match_code():
    data = request.json or {}
    match_id = data.get('match_id')
    code = str(data.get('verification_code', '')).strip()
    actor_id = data.get('actor_id')

    if not match_id or not code:
        return jsonify({"success": False, "message": "match_id and verification_code required"}), 400

    context = get_match_context(match_id)
    if not context:
        return jsonify({"success": False, "message": "Match context not found"}), 404

    expected_hash = context['lost_item'].get('verification_code_hash')
    if not expected_hash:
        return jsonify({"success": False, "message": "No recovery code set on this lost report"}), 400

    if hash_recovery_code(code) != expected_hash:
        audit_service.log_event(
            event_type='MATCH_CODE_FAILED',
            actor_id=actor_id,
            entity_type='match',
            entity_id=match_id,
            metadata={}
        )
        return jsonify({"success": False, "message": "Invalid recovery code"}), 403

    matches = load_jsonl_records('matches.txt')
    updated = False
    for m in matches:
        if m.get('match_id') == match_id:
            m['verification_status'] = 'verified'
            m['verified_at'] = datetime.utcnow().isoformat() + 'Z'
            m['verified_by'] = actor_id
            updated = True
            break

    if not updated:
        return jsonify({"success": False, "message": "Match not found"}), 404

    write_jsonl_records('matches.txt', matches)
    audit_service.log_event(
        event_type='MATCH_CODE_VERIFIED',
        actor_id=actor_id,
        entity_type='match',
        entity_id=match_id,
        metadata={}
    )

    return jsonify({"success": True, "message": "Recovery code verified. You can now close this case."}), 200


@app.route('/claim/initiate', methods=['POST'])
def claim_initiate():
    data = request.json or {}
    match_id = data.get('match_id')
    claimant_id = data.get('claimant_id')

    if not match_id or not claimant_id:
        return jsonify({"success": False, "message": "match_id and claimant_id required"}), 400

    context = get_match_context(match_id)
    if not context:
        return jsonify({"success": False, "message": "Match context not found"}), 404

    if claimant_id == context['finder_user_id']:
        return jsonify({"success": False, "message": "Finder cannot claim ownership"}), 403

    risk = risk_engine.score_claim(
        claimant_id=claimant_id,
        match_record={
            'finder_user_id': context['finder_user_id']
        },
        item_priority=context['item_priority']
    )

    expected_private = context['lost_item'].get('private_proof', {})
    challenge_fields = [
        key for key in [
            'private_markings',
            'inside_contents',
            'purchase_proof_hint',
            'known_damage_marks'
        ] if normalize_text(expected_private.get(key))
    ]

    claim_record = {
        'claim_id': get_next_id('CLM', 'claims.txt'),
        'match_id': match_id,
        'claimant_id': claimant_id,
        'owner_user_id': context['owner_user_id'],
        'finder_user_id': context['finder_user_id'],
        'risk_score': risk['score'],
        'risk_level': risk['level'],
        'challenge_fields': challenge_fields,
        'status': 'pending_verification',
        'created_at': datetime.utcnow().isoformat() + 'Z'
    }
    append_jsonl_record('claims.txt', claim_record)

    audit_service.log_event(
        event_type='CLAIM_INITIATED',
        actor_id=claimant_id,
        entity_type='claim',
        entity_id=claim_record['claim_id'],
        metadata={
            'match_id': match_id,
            'risk_level': risk['level'],
            'risk_score': risk['score'],
            'challenge_fields_count': len(challenge_fields)
        }
    )

    return jsonify({
        "success": True,
        "claim_id": claim_record['claim_id'],
        "risk_level": risk['level'],
        "risk_score": risk['score'],
        "challenge_fields": challenge_fields,
        "message": "Claim initiated. Submit private answers for verification."
    }), 201


@app.route('/claim/verify', methods=['POST'])
def claim_verify():
    data = request.json or {}
    claim_id = data.get('claim_id')
    claimant_id = data.get('claimant_id')
    answers = data.get('answers', {})

    if not claim_id or not claimant_id:
        return jsonify({"success": False, "message": "claim_id and claimant_id required"}), 400

    claims = load_jsonl_records('claims.txt')
    claim = None
    claim_index = -1
    for idx, item in enumerate(claims):
        if item.get('claim_id') == claim_id:
            claim = item
            claim_index = idx
            break

    if not claim:
        return jsonify({"success": False, "message": "Claim not found"}), 404

    if claim.get('claimant_id') != claimant_id:
        return jsonify({"success": False, "message": "Unauthorized claimant"}), 403

    if claim.get('status') not in {'pending_verification', 'verification_failed'}:
        return jsonify({"success": False, "message": f"Claim cannot be verified in status {claim.get('status')}"}), 400

    context = get_match_context(claim.get('match_id'))
    if not context:
        return jsonify({"success": False, "message": "Match context unavailable"}), 404

    expected_private = context['lost_item'].get('private_proof', {})
    verification_result = evaluate_private_answers(expected_private, answers)

    attempt_record = {
        'attempt_id': get_next_id('VAT', 'verification_attempts.txt'),
        'claim_id': claim_id,
        'claimant_id': claimant_id,
        'result': 'passed' if verification_result['pass'] else 'failed',
        'match_score': verification_result['score'],
        'matched_count': verification_result['matched_count'],
        'required_count': verification_result['required_count'],
        'reason': verification_result['reason'],
        'created_at': datetime.utcnow().isoformat() + 'Z'
    }
    append_jsonl_record('verification_attempts.txt', attempt_record)

    if verification_result['pass']:
        if claim.get('risk_level') == 'high':
            claim['status'] = 'escalated_admin_review'
            claims[claim_index] = claim
            write_jsonl_records('claims.txt', claims)
            audit_service.log_event(
                event_type='CLAIM_ESCALATED',
                actor_id=claimant_id,
                entity_type='claim',
                entity_id=claim_id,
                metadata={'risk_level': claim.get('risk_level')}
            )
            return jsonify({
                "success": True,
                "claim_status": claim['status'],
                "message": "Verification passed, but claim is escalated for admin review due to high risk."
            }), 200

        token_record, owner_token, finder_token = create_handover_tokens(
            claim_id=claim_id,
            match_id=claim.get('match_id'),
            owner_user_id=claim.get('owner_user_id'),
            finder_user_id=claim.get('finder_user_id')
        )
        claim['status'] = 'verified_pending_handover'
        claim['token_id'] = token_record['token_id']
        claims[claim_index] = claim
        write_jsonl_records('claims.txt', claims)

        audit_service.log_event(
            event_type='CLAIM_VERIFIED',
            actor_id=claimant_id,
            entity_type='claim',
            entity_id=claim_id,
            metadata={
                'token_id': token_record['token_id'],
                'match_id': claim.get('match_id')
            }
        )

        return jsonify({
            "success": True,
            "claim_status": claim['status'],
            "token_id": token_record['token_id'],
            "owner_token": owner_token,
            "finder_token": finder_token,
            "message": "Verification passed. Use both handover tokens to confirm physical return."
        }), 200

    claim['status'] = 'verification_failed'
    claims[claim_index] = claim
    write_jsonl_records('claims.txt', claims)

    audit_service.log_event(
        event_type='CLAIM_VERIFICATION_FAILED',
        actor_id=claimant_id,
        entity_type='claim',
        entity_id=claim_id,
        metadata={
            'match_score': verification_result['score'],
            'matched_count': verification_result['matched_count'],
            'required_count': verification_result['required_count']
        }
    )

    return jsonify({
        "success": False,
        "claim_status": claim['status'],
        "message": "Verification answers did not match private ownership proof.",
        "result": verification_result
    }), 403


@app.route('/handover/confirm', methods=['POST'])
def handover_confirm():
    data = request.json or {}
    match_id = data.get('match_id')
    claim_id = data.get('claim_id')
    owner_token = data.get('owner_token')
    finder_token = data.get('finder_token')
    actor_id = data.get('actor_id')

    if not all([match_id, claim_id, owner_token, finder_token]):
        return jsonify({"success": False, "message": "match_id, claim_id, owner_token, finder_token required"}), 400

    tokens = load_jsonl_records('handover_tokens.txt')
    token = None
    token_index = -1
    for idx, t in enumerate(tokens):
        if t.get('claim_id') == claim_id and t.get('match_id') == match_id and t.get('status') == 'active':
            token = t
            token_index = idx
            break

    if not token:
        return jsonify({"success": False, "message": "Active handover token record not found"}), 404

    try:
        if datetime.fromisoformat(token['expires_at'].replace('Z', '')) < datetime.utcnow():
            token['status'] = 'expired'
            tokens[token_index] = token
            write_jsonl_records('handover_tokens.txt', tokens)
            return jsonify({"success": False, "message": "Handover tokens expired"}), 410
    except Exception:
        return jsonify({"success": False, "message": "Token record corrupted"}), 500

    if hash_token(owner_token) != token.get('owner_token_hash') or hash_token(finder_token) != token.get('finder_token_hash'):
        return jsonify({"success": False, "message": "Invalid handover tokens"}), 403

    matches = load_jsonl_records('matches.txt')
    updated = False
    for m in matches:
        if m.get('match_id') == match_id:
            m['status'] = 'resolved'
            m['resolved_via'] = 'secure_handover_token'
            m['resolved_at'] = datetime.utcnow().isoformat() + 'Z'
            updated = True
            break

    if not updated:
        return jsonify({"success": False, "message": "Match not found"}), 404
    write_jsonl_records('matches.txt', matches)

    update_items_for_match_status(match_id, 'closed')

    claims = load_jsonl_records('claims.txt')
    for c in claims:
        if c.get('claim_id') == claim_id:
            c['status'] = 'handover_confirmed'
            c['updated_at'] = datetime.utcnow().isoformat() + 'Z'
            break
    write_jsonl_records('claims.txt', claims)

    token['status'] = 'used'
    token['used_at'] = datetime.utcnow().isoformat() + 'Z'
    tokens[token_index] = token
    write_jsonl_records('handover_tokens.txt', tokens)

    finder_id = get_finder_user_id_for_match(match_id)
    if finder_id:
        incentive_service.award_points(
            user_id=finder_id,
            points=150,
            reason='handover_confirmed',
            extra={'match_id': match_id, 'claim_id': claim_id}
        )

    audit_service.log_event(
        event_type='HANDOVER_CONFIRMED',
        actor_id=actor_id,
        entity_type='match',
        entity_id=match_id,
        metadata={
            'claim_id': claim_id,
            'finder_id': finder_id,
            'reward_points': 150 if finder_id else 0
        }
    )

    return jsonify({
        "success": True,
        "message": "Secure handover confirmed and case resolved.",
        "match_id": match_id,
        "claim_id": claim_id
    }), 200

@app.route('/my_data', methods=['GET'])
def get_my_data():
    user_id = request.args.get('user_id')
    if not user_id:
        return jsonify({"success": False, "message": "user_id is required"}), 400
        
    lost_items = []
    if os.path.exists(os.path.join(DB_DIR, 'lost.txt')):
        with open(os.path.join(DB_DIR, 'lost.txt'), 'r') as f:
            for line in f:
                if line.strip():
                    item = json.loads(line)
                    if item.get("user_id") == user_id:
                        lost_items.append(item)
                        
    found_items = []
    if os.path.exists(os.path.join(DB_DIR, 'found.txt')):
        with open(os.path.join(DB_DIR, 'found.txt'), 'r') as f:
            for line in f:
                if line.strip():
                    item = json.loads(line)
                    if item.get("user_id") == user_id:
                        found_items.append(item)
                        
    my_matches = []
    if os.path.exists(os.path.join(DB_DIR, 'chats.txt')) and os.path.exists(os.path.join(DB_DIR, 'matches.txt')):
        # First gather match_ids relevant to this user
        user_match_ids = set()
        user_chats = {} # match_id -> chat_id
        with open(os.path.join(DB_DIR, 'chats.txt'), 'r') as f:
            for line in f:
                if line.strip():
                    try:
                        chat = json.loads(line)
                        if chat.get('user1_id') == user_id or chat.get('user2_id') == user_id:
                            # Exclude self-matches where the same user reported both lost and found.
                            if chat.get('user1_id') == user_id and chat.get('user2_id') == user_id:
                                continue
                            match_id = chat.get('match_id')
                            user_match_ids.add(match_id)
                            user_chats[match_id] = chat.get('chat_id')
                    except Exception:
                        pass
        
        # Calculate message counts
        chat_msg_counts = {}
        msg_file = os.path.join(DB_DIR, 'messages.txt')
        if os.path.exists(msg_file):
            with open(msg_file, 'r') as f:
                for line in f:
                    if line.strip():
                        try:
                            msg = json.loads(line)
                            cid = msg.get('chat_id')
                            if cid in chat_msg_counts:
                                chat_msg_counts[cid] += 1
                            else:
                                chat_msg_counts[cid] = 1
                        except:
                            pass

        # Then grab those matches
        with open(os.path.join(DB_DIR, 'matches.txt'), 'r') as f:
            for line in f:
                if line.strip():
                    try:
                        match = json.loads(line)
                        m_id = match.get('match_id')
                        if m_id in user_match_ids:
                            cid = user_chats.get(m_id)
                            match['message_count'] = chat_msg_counts.get(cid, 0)
                            my_matches.append(match)
                    except:
                        pass

    return jsonify({
        "success": True,
        "lost_items": lost_items,
        "found_items": found_items,
        "matches": my_matches
    }), 200

@app.route('/delete_item', methods=['POST'])
def delete_item():
    data = request.json
    item_type = data.get('item_type') # 'lost' or 'found'
    item_id = data.get('item_id')
    user_id = data.get('user_id')
    
    if not all([item_type, item_id, user_id]):
        return jsonify({"success": False, "message": "Missing parameters"}), 400
        
    filename = f"{item_type}.txt"
    filepath = os.path.join(DB_DIR, filename)
    
    if not os.path.exists(filepath):
        return jsonify({"success": False, "message": "Database not found."}), 404
        
    lines_to_keep = []
    deleted = False
    
    with open(filepath, 'r') as f:
        for line in f:
            if line.strip():
                item = json.loads(line)
                key = f"{item_type}_id"
                if item.get(key) == item_id and item.get('user_id') == user_id:
                    deleted = True
                else:
                    lines_to_keep.append(line)
                    
    if deleted:
        with open(filepath, 'w') as f:
            for line in lines_to_keep:
                f.write(line)
                
        # Also delete associated matches and chats to prevent orphaned data
        matches_file = os.path.join(DB_DIR, 'matches.txt')
        deleted_match_ids = set()
        
        if os.path.exists(matches_file):
            matches_to_keep = []
            with open(matches_file, 'r') as f:
                for line in f:
                    if line.strip():
                        match = json.loads(line)
                        if match.get(f"{item_type}_id") == item_id:
                            deleted_match_ids.add(match.get('match_id'))
                        else:
                            matches_to_keep.append(line)
            with open(matches_file, 'w') as f:
                for line in matches_to_keep:
                    f.write(line)
                    
        chats_file = os.path.join(DB_DIR, 'chats.txt')
        if os.path.exists(chats_file) and deleted_match_ids:
            chats_to_keep = []
            with open(chats_file, 'r') as f:
                for line in f:
                    if line.strip():
                        chat = json.loads(line)
                        if chat.get('match_id') not in deleted_match_ids:
                            chats_to_keep.append(line)
            with open(chats_file, 'w') as f:
                for line in chats_to_keep:
                    f.write(line)
                    
        return jsonify({"success": True, "message": "Item deleted."}), 200
        
    return jsonify({"success": False, "message": "Item not found or unauthorized."}), 403

@app.route('/chat/messages', methods=['GET'])
def get_chat_messages():
    chat_id = request.args.get('chat_id')
    if not chat_id:
        return jsonify({"success": False, "message": "chat_id required"}), 400

    messages = []
    filepath = os.path.join(DB_DIR, 'messages.txt')
    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            for line in f:
                if line.strip():
                    try:
                        msg = json.loads(line)
                        if msg.get('chat_id') == chat_id:
                            messages.append(msg)
                    except:
                        pass
    return jsonify({"success": True, "messages": messages}), 200

@app.route('/chat/send', methods=['POST'])
def send_message():
    data = request.json
    chat_id = data.get('chat_id')
    sender_id = data.get('sender_id')
    text = data.get('text')

    if not all([chat_id, sender_id, text]):
        return jsonify({"success": False, "message": "Missing parameters"}), 400

    message_id = get_next_id('MSG', 'messages.txt')
    record = {
        "message_id": message_id,
        "chat_id": chat_id,
        "sender_id": sender_id,
        "text": text,
        "created_at": datetime.utcnow().isoformat() + "Z"
    }

    with open(os.path.join(DB_DIR, 'messages.txt'), 'a') as f:
        f.write(json.dumps(record) + "\n")

    return jsonify({"success": True, "message": "Sent", "data": record}), 201

@app.route('/match/resolve', methods=['POST'])
def resolve_match():
    data = request.json
    match_id = data.get('match_id')

    if not match_id:
        return jsonify({"success": False, "message": "match_id required"}), 400

    filepath = os.path.join(DB_DIR, 'matches.txt')
    matches = []
    updated = False

    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            for line in f:
                if line.strip():
                    m = json.loads(line)
                    if m.get('match_id') == match_id:
                        if m.get('verification_required', False) and m.get('verification_status') != 'verified':
                            return jsonify({
                                "success": False,
                                "message": "Please verify the recovery code before closing this case."
                            }), 403
                        m['status'] = 'resolved'
                        updated = True
                    matches.append(m)

        if updated:
            with open(filepath, 'w') as f:
                for m in matches:
                    f.write(json.dumps(m) + "\n")

            update_items_for_match_status(match_id, 'closed')

            finder_id = get_finder_user_id_for_match(match_id)
            if finder_id:
                incentive_service.award_points(
                    user_id=finder_id,
                    points=100,
                    reason='match_resolved',
                    extra={'match_id': match_id}
                )

            audit_service.log_event(
                event_type='MATCH_RESOLVED',
                actor_id=data.get('actor_id'),
                entity_type='match',
                entity_id=match_id,
                metadata={'finder_id': finder_id, 'reward_points': 100 if finder_id else 0}
            )
            return jsonify({"success": True, "message": "Match resolved"}), 200

    return jsonify({"success": False, "message": "Match not found"}), 404

@app.route('/admin/matches', methods=['GET'])
def get_admin_matches():
    # Helper to load a file into a dict keyed by item_id
    def load_items(filename, id_key):
        items = {}
        path = os.path.join(DB_DIR, filename)
        if os.path.exists(path):
            with open(path, 'r') as f:
                for line in f:
                    if line.strip():
                        try:
                            item = json.loads(line)
                            items[item.get(id_key)] = item
                        except: pass
        return items

    lost_items = load_items('lost.txt', 'lost_id')
    found_items = load_items('found.txt', 'found_id')
    
    matches = []
    matches_path = os.path.join(DB_DIR, 'matches.txt')
    if os.path.exists(matches_path):
        with open(matches_path, 'r') as f:
            for line in f:
                if line.strip():
                    try:
                        m = json.loads(line)
                        m['lost_item'] = lost_items.get(m.get('lost_id'))
                        m['found_item'] = found_items.get(m.get('found_id'))
                        matches.append(m)
                    except: pass
                    
    return jsonify({"success": True, "matches": matches}), 200

@app.route('/admin/update_match', methods=['POST'])
def admin_update_match():
    data = request.json
    match_id = data.get('match_id')
    action = data.get('action') # 'approve', 'reject', 'handover'
    
    if not match_id or not action:
        return jsonify({"success": False, "message": "Missing parameters"}), 400
        
    valid_status_map = {
        'approve': 'approved',
        'reject': 'rejected',
        'handover': 'resolved'
    }
    
    if action not in valid_status_map:
        return jsonify({"success": False, "message": "Invalid action"}), 400
        
    new_status = valid_status_map[action]

    filepath = os.path.join(DB_DIR, 'matches.txt')
    matches = []
    updated = False

    if os.path.exists(filepath):
        with open(filepath, 'r') as f:
            for line in f:
                if line.strip():
                    try:
                        m = json.loads(line)
                        if m.get('match_id') == match_id:
                            m['status'] = new_status
                            updated = True
                        matches.append(m)
                    except: pass

        if updated:
            with open(filepath, 'w') as f:
                for m in matches:
                    f.write(json.dumps(m) + "\n")
                    
            # Log the admin action
            action_log = {
                "action_id": get_next_id('ACT', 'admin_actions.txt'),
                "match_id": match_id,
                "action": action,
                "timestamp": datetime.utcnow().isoformat() + "Z"
            }
            with open(os.path.join(DB_DIR, 'admin_actions.txt'), 'a') as f:
                f.write(json.dumps(action_log) + "\n")

            finder_id = None
            if new_status == 'resolved':
                update_items_for_match_status(match_id, 'closed')
                finder_id = get_finder_user_id_for_match(match_id)
                if finder_id:
                    incentive_service.award_points(
                        user_id=finder_id,
                        points=150,
                        reason='handover_confirmed',
                        extra={'match_id': match_id, 'source': 'admin'}
                    )

            audit_service.log_event(
                event_type='ADMIN_MATCH_ACTION',
                actor_id='ADMIN',
                entity_type='match',
                entity_id=match_id,
                metadata={
                    'action': action,
                    'new_status': new_status,
                    'finder_id': finder_id,
                    'reward_points': 150 if finder_id and new_status == 'resolved' else 0
                }
            )
                
            return jsonify({"success": True, "message": f"Match {action}d successfully"}), 200

    return jsonify({"success": False, "message": "Match not found"}), 404


@app.route('/incentives/<user_id>', methods=['GET'])
def get_incentive_profile(user_id):
    profile = incentive_service.get_user_profile(user_id)
    return jsonify({"success": True, "profile": profile}), 200


# ============= PROBLEM 3: Match Explanation, Admin Evidence Console & KPI Metrics =============

@app.route('/match/<match_id>/explanation', methods=['GET'])
def get_match_explanation(match_id):
    """
    Returns detailed explanation of why a match was made:
    - Text matching scores
    - Location/time plausibility
    - Risk level assessment
    """
    context = get_match_context(match_id)
    if not context:
        return jsonify({"success": False, "message": "Match not found"}), 404
    
    lost_item = context['lost_item']
    found_item = context['found_item']
    match = context['match']
    
    # Text similarity scores
    text_score = text_similarity(
        lost_item.get('item_name', '') + ' ' + lost_item.get('description', ''),
        found_item.get('item_name', '') + ' ' + found_item.get('description', '')
    )
    
    # Location plausibility
    location_score = 1.0 if lost_item.get('location', '').lower() == found_item.get('location', '').lower() else 0.7
    
    # Time plausibility
    days_diff = 0
    try:
        lost_date = datetime.fromisoformat(lost_item.get('date', '2000-01-01').replace('Z', ''))
        found_date = datetime.fromisoformat(found_item.get('date', '2000-01-01').replace('Z', ''))
        days_diff = abs((found_date - lost_date).days)
        time_score = max(0.3, 1.0 - (days_diff / 30.0))
    except:
        time_score = 0.5
    
    # Risk level
    priority = found_item.get('item_priority', 'normal')
    risk_levels = {
        'critical_id': 'HIGH - Critical ID requires immediate verification',
        'high_value': 'MEDIUM - High-value item requires standard verification',
        'normal': 'LOW - Standard verification applies'
    }
    
    # Aggregate confidence
    confidence = round((text_score * 0.5 + location_score * 0.3 + time_score * 0.2) * 100, 1)
    
    return jsonify({
        "success": True,
        "match_id": match_id,
        "explanation": {
            "overall_confidence": confidence,
            "confidence_level": "HIGH" if confidence >= 75 else "MEDIUM" if confidence >= 50 else "LOW",
            "scoring_breakdown": {
                "text_match": {
                    "score": round(text_score * 100, 1),
                    "lost_keywords": lost_item.get('item_name', ''),
                    "found_keywords": found_item.get('item_name', ''),
                    "reasoning": f"Item descriptions match with {round(text_score * 100, 1)}% similarity"
                },
                "location_plausibility": {
                    "score": round(location_score * 100, 1),
                    "lost_location": lost_item.get('location', 'Unknown'),
                    "found_location": found_item.get('location', 'Unknown'),
                    "reasoning": "Item found in same or nearby location as lost report"
                },
                "time_plausibility": {
                    "score": round(time_score * 100, 1),
                    "lost_date": lost_item.get('date', 'Unknown'),
                    "found_date": found_item.get('date', 'Unknown'),
                    "reasoning": f"Item found {days_diff} days after loss report"
                }
            },
            "risk_assessment": {
                "priority_level": priority,
                "risk_description": risk_levels.get(priority, 'Unknown'),
                "verification_required": priority != 'normal'
            },
            "match_metadata": {
                "match_id": match_id,
                "verification_status": match.get('verification_status', 'pending'),
                "verification_score": match.get('verification_score'),
                "created_at": match.get('created_at'),
                "updated_at": match.get('updated_at')
            }
        }
    }), 200


@app.route('/audit/match/<match_id>/timeline', methods=['GET'])
def get_match_audit_timeline(match_id):
    """
    Returns audit trail (timeline of events) for a specific match.
    """
    audit_events = load_jsonl_records('audit_events.txt')
    timeline_events = []
    
    event_descriptions = {
        'MATCH_CREATED': '✓ Match created by AI matching engine',
        'MATCH_ANSWERS_VERIFIED': '✓ Verification answers submitted and verified',
        'MATCH_ANSWERS_FAILED': '✗ Verification answers failed validation',
        'MATCH_CODE_VERIFIED': '✓ Recovery code verified',
        'MATCH_CODE_FAILED': '✗ Recovery code verification failed',
        'MATCH_RESOLVED': '✓ Match resolved successfully',
        'CLAIM_INITIATED': '⚠ Claim initiated for item',
        'CLAIM_VERIFIED': '✓ Claim verified and approved',
        'CLAIM_VERIFICATION_FAILED': '✗ Claim verification failed',
        'CLAIM_ESCALATED': '⚠ Claim escalated for admin review (high risk)',
        'HANDOVER_CONFIRMED': '✓ Secure handover completed',
        'HANDOVER_FAILED': '✗ Handover failed or tokens expired'
    }
    
    for event in audit_events:
        if event.get('entity_id') == match_id or event.get('metadata', {}).get('match_id') == match_id:
            timeline_events.append({
                'timestamp': event.get('created_at', datetime.utcnow().isoformat()),
                'event_type': event.get('event_type'),
                'actor_id': event.get('actor_id'),
                'description': event_descriptions.get(event.get('event_type'), event.get('event_type')),
                'metadata': event.get('metadata', {})
            })
    
    timeline_events.sort(key=lambda x: x['timestamp'])
    
    return jsonify({
        "success": True,
        "match_id": match_id,
        "timeline": timeline_events,
        "event_count": len(timeline_events)
    }), 200


@app.route('/metrics/summary', methods=['GET'])
def get_metrics_summary():
    """
    Returns KPI metrics: precision rate, false-claim rate, handover success, resolution time.
    """
    matches = load_jsonl_records('matches.txt')
    claims = load_jsonl_records('claims.txt')
    
    # Match statistics
    total_matches = len(matches)
    resolved_matches = len([m for m in matches if m.get('status') == 'resolved'])
    verified_matches = len([m for m in matches if m.get('verification_status') == 'verified'])
    
    # Precision: successful resolutions via handover
    successful_resolutions = len([m for m in matches if m.get('resolved_via') == 'secure_handover_token'])
    precision = (successful_resolutions / total_matches * 100) if total_matches > 0 else 0
    
    # Claim statistics
    total_claims = len(claims)
    verified_claims = len([c for c in claims if c.get('status') in ['verified_pending_handover', 'handover_confirmed']])
    failed_claims = len([c for c in claims if c.get('status') in ['verification_failed', 'failed']])
    escalated_claims = len([c for c in claims if c.get('status') == 'escalated_admin_review'])
    
    false_claim_rate = (failed_claims / total_claims * 100) if total_claims > 0 else 0
    handover_success_rate = (verified_claims / total_claims * 100) if total_claims > 0 else 0
    
    # Resolution time analysis
    resolution_times = []
    for match in matches:
        if match.get('created_at') and match.get('resolved_at'):
            try:
                created = datetime.fromisoformat(match.get('created_at', '').replace('Z', ''))
                resolved = datetime.fromisoformat(match.get('resolved_at', '').replace('Z', ''))
                hours_to_resolve = (resolved - created).total_seconds() / 3600
                resolution_times.append(hours_to_resolve)
            except:
                pass
    
    avg_resolution_time = sum(resolution_times) / len(resolution_times) if resolution_times else 0
    
    # Priority distribution
    all_items = load_jsonl_records('found.txt')
    priority_counts = {}
    for item in all_items:
        priority = item.get('item_priority', 'normal')
        priority_counts[priority] = priority_counts.get(priority, 0) + 1
    
    high_risk_claims = len([c for c in claims if c.get('risk_level') == 'high'])
    
    return jsonify({
        "success": True,
        "metrics": {
            "matches": {
                "total": total_matches,
                "resolved": resolved_matches,
                "verified": verified_matches,
                "precision_rate": round(precision, 1),
                "avg_resolution_hours": round(avg_resolution_time, 1)
            },
            "claims": {
                "total": total_claims,
                "completed": verified_claims,
                "failed": failed_claims,
                "escalated": escalated_claims,
                "false_claim_rate": round(false_claim_rate, 1),
                "handover_success_rate": round(handover_success_rate, 1)
            },
            "item_distribution": priority_counts,
            "system_health": {
                "average_resolution_hours": round(avg_resolution_time, 1),
                "escalation_rate": round((escalated_claims / total_claims * 100) if total_claims > 0 else 0, 1),
                "system_integrity": "✓ Healthy" if precision >= 80 and false_claim_rate < 10 else "⚠ Monitor"
            }
        }
    }), 200

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get('PORT', 5000)))

