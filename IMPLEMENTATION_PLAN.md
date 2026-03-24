# Lost and Found Campus System (AI) - Detailed Implementation Plan

## Goal
Build a working “Lost & Found Campus System using AI” where users:
1. Log in (email or student ID).
2. Submit *lost* and *found* item reports (with images).
3. The backend runs an AI-based matching to suggest likely matches.
4. Users chat to verify details after a match is found.
5. Admin reviews the verification and approves/rejects.
6. System marks the case resolved and records handover.

## Target Tech Stack (Recommended)
- Frontend: HTML + CSS + vanilla JavaScript (static pages)
- Backend: Python + Flask (simple REST routes + session handling)
- Storage: Plain text “database” files in `database/` (line-delimited records)
- AI:
  - Text matching: keyword extraction + similarity scoring
  - Image matching: lightweight similarity (hashing) or embedding-based (optional)

## Project Structure (Use as Baseline)
```
lost-found-ai-system/
│
├── frontend/
│   ├── index.html
│   ├── login.html
│   ├── dashboard.html
│   ├── chat.html
│   ├── match.html
│   ├── css/
│   └── js/
│
├── backend/
│   ├── app.py
│   ├── auth.py
│   ├── item_routes.py
│   ├── match_routes.py
│   ├── chat_routes.py
│
├── database/
│   ├── users.txt
│   ├── lost.txt
│   ├── found.txt
│   ├── matches.txt
│   ├── chats.txt
│   ├── messages.txt
│   ├── admin_actions.txt
│   └── handover.txt
│
├── ai/
│   ├── text_matching.py
│   ├── image_matching.py
│   └── matcher.py
│
├── static/
│   ├── images/
│   └── uploads/
│
├── templates/ (if using Flask templates)
│
├── requirements.txt
└── README.md
```

## Data Contracts (Plain Text “Database” Formats)
All `.txt` files should be *line-delimited JSON* to keep parsing simple and robust:

### `database/users.txt`
Each line: one JSON object
```json
{
  "user_id": "U123",
  "email_or_student_id": "name@example.com",
  "created_at": "2026-03-23T10:12:00Z"
}
```

### `database/lost.txt`
```json
{
  "lost_id": "L0001",
  "user_id": "U123",
  "item_name": "Water Bottle",
  "description": "Black bottle with sticker",
  "location": "Milton Block",
  "date": "2026-03-21",
  "image_path": "static/uploads/lost/L0001.jpg",
  "created_at": "2026-03-23T10:12:00Z"
}
```

### `database/found.txt`
```json
{
  "found_id": "F0007",
  "user_id": "U456",
  "item_name": "Bottle",
  "description": "Black bottle near canteen",
  "location": "Canteen",
  "date": "2026-03-22",
  "image_path": "static/uploads/found/F0007.jpg",
  "created_at": "2026-03-23T10:12:00Z"
}
```

### `database/matches.txt`
```json
{
  "match_id": "M0010",
  "lost_id": "L0001",
  "found_id": "F0007",
  "score": 0.78,
  "status": "pending",
  "created_at": "2026-03-23T10:20:00Z",
  "chat_id": "C0003"
}
```

### `database/chats.txt`
```json
{
  "chat_id": "C0003",
  "user1_id": "U123",
  "user2_id": "U456",
  "match_id": "M0010",
  "created_at": "2026-03-23T10:20:00Z"
}
```

### `database/messages.txt`
```json
{
  "message_id": "MSG00042",
  "chat_id": "C0003",
  "sender_id": "U123",
  "text": "Is there a scratch?",
  "created_at": "2026-03-23T10:25:10Z",
  "seen_by": ["U123"]
}
```

### `database/admin_actions.txt`
```json
{
  "action_id": "A0001",
  "match_id": "M0010",
  "admin_user_id": "ADMIN",
  "action": "approved",
  "notes": "Verified proof image",
  "created_at": "2026-03-23T10:40:00Z"
}
```

### `database/handover.txt`
```json
{
  "handover_id": "H0001",
  "match_id": "M0010",
  "handover_location": "College office",
  "handover_date": "2026-03-24",
  "handover_time": "15:30",
  "user1_id": "U123",
  "user2_id": "U456",
  "created_at": "2026-03-23T10:50:00Z"
}
```

## Core Backend Routes (API Plan)
These routes map directly to your frontend forms and pages.

### Authentication
1. `POST /login`
   - Input: `email_or_student_id`
   - Output:
     - `user_id` and success message
   - Behavior:
     - If user exists in `users.txt`, return it.
     - Else create new `user_id` and append to `users.txt`.

2. Session handling
   - Use Flask `session` to track logged-in user (store `user_id`).

### Reporting Items
3. `POST /submit_lost`
   - Auth required
   - Input (multipart/form-data):
     - `item_name`, `description`, `location`, `date`, optional `image` (optional per statement)
   - Output:
     - `lost_id` + success message

4. `POST /submit_found`
   - Auth required
   - Input (multipart/form-data):
     - `item_name`, `description`, `location`, `date`, `image` (required per statement)
   - Output:
     - `found_id` + success message

After each submission, the system may trigger matching or wait for `/match` (see matching strategy below).

### Matching
5. `POST /match`
   - Auth optional (admin/system) depending on your design
   - Input:
     - optional filters (e.g., latest lost only)
   - Output:
     - list of newly created matches or matches for a user

Matching behavior:
- For each lost item vs each found item:
  - Compute `text_score` from descriptions
  - Compute `image_score` from images
  - Compute `final_score = (0.6 * image_score) + (0.4 * text_score)`
  - If `final_score >= 0.70`:
    - create entry in `matches.txt` with `status="pending"`
    - create chat room entry in `chats.txt`
    - notify both users (in UI via redirect/poll or fetch)

### Chat
6. `GET /my_matches`
   - Auth required
   - Output: matches for logged-in user where status is `pending` or `approved` (per your policy)

7. `POST /chat/start`
   - Auth required
   - Input: `match_id`
   - Behavior:
     - find/create `chat_id`
     - allow chat only when `match_found` condition is satisfied
   - Output: `chat_id`

8. `POST /chat/send`
   - Auth required
   - Input:
     - `chat_id`, `text` (optional: image-proof upload plan)
   - Behavior:
     - verify sender is one of the chat users
     - append message to `messages.txt`
   - Output:
     - message confirmation (and message echo)

9. `GET /chat/messages?chat_id=...`
   - Auth required
   - Output: ordered message list

10. Seen status
   - Minimal option:
     - When client loads messages, backend updates `seen_by` with the viewer’s user_id.
   - Real-time option (optional):
     - Polling every N seconds to update UI (simpler than websockets for PPT).

### Admin Verification & Handover
11. `GET /admin/matches`
   - Auth required (admin session)
   - Output: list of pending matches

12. `POST /admin/approve`
   - Input: `match_id`
   - Behavior:
     - set match status to `approved`
     - record action to `admin_actions.txt`

13. `POST /admin/reject`
   - Input: `match_id`
   - Behavior:
     - set match status to `rejected`
     - record action to `admin_actions.txt`

14. `POST /admin/handover`
   - Input: `match_id`, `handover_location`, `handover_date`, `handover_time`
   - Behavior:
     - append record to `handover.txt`
     - set match status to `resolved`

## Matching Engine Implementation Plan (AI)
### 1) Text Matching (`ai/text_matching.py`)
Inputs: lost.description and found.description (or include item_name/location)
Steps:
1. Normalize:
   - convert to lowercase
   - remove punctuation
2. Tokenize:
   - split on whitespace
3. Stopword removal:
   - remove common stopwords (define a small static list suitable for campus English)
4. Keyword extraction:
   - optionally keep top-N tokens by frequency
5. Similarity:
   - Simple approach: Jaccard similarity over token sets
   - Or cosine similarity using TF-IDF (requires scikit-learn)

Function signature example:
- `get_text_score(text1: str, text2: str) -> float` returning `0.0 - 1.0`

### 2) Image Matching (`ai/image_matching.py`)
Goal: return `0.0 - 1.0` similarity between two images.
Two implementation options:

Option A (Lightweight, recommended for quick build):
- Use perceptual hashing:
  - load image with Pillow
  - compute perceptual hash (pHash or dHash)
  - compare hashes to get similarity score
- Output:
  - similarity mapped to `0.0 - 1.0`

Option B (Embedding-based, more “AI-like”):
- Use a pre-trained CNN (e.g., MobileNet) to extract embeddings
- Compare cosine similarity between embeddings
- Requires extra dependencies and longer startup.

Function signature example:
- `get_image_score(image_path1: str | None, image_path2: str | None) -> float`
Notes:
- If a lost image is missing (optional in requirements), treat image score as:
  - either 0.0
  - or fallback to text-only (and document decision)

### 3) Combined Matching (`ai/matcher.py`)
Algorithm:
1. Load lost items list
2. Load found items list
3. For each pair:
   - text_score = get_text_score(...)
   - image_score = get_image_score(...)
   - final = 0.6 * image_score + 0.4 * text_score
4. If final >= 0.70:
   - create match record
   - create chat room record

Important rules:
- Avoid duplicate matches:
  - before creating match, check if `(lost_id, found_id)` already exists in `matches.txt`
- Add timestamps for traceability.

## Frontend Implementation Plan (By Requirement Pages)
### Common Frontend Setup
- Use consistent styling in `frontend/css/`
- Put shared API helper functions in `frontend/js/api.js` (optional)

### Pages
1. `index.html`
   - Navigation bar:
     - Home
     - Report Lost
     - Report Found
2. `login.html`
   - Email/student ID input
   - Submit -> `POST /login`
3. `dashboard.html`
   - After login:
     - show user’s submitted lost items
     - show user’s submitted found items
     - show matches list
4. `match.html`
   - For selected match:
     - show lost details vs found details
     - show computed `score`
     - show button `Start Chat` (enabled only if match is found)
5. `chat.html`
   - Chat UI:
     - message list
     - input box
     - send button
   - Polling strategy:
     - every few seconds call `GET /chat/messages`
     - update UI

## Detailed Roll-Wise Work Plan
Each “R” below corresponds to a milestone that can be implemented and tested independently.

### R1 - Frontend Landing + Forms
Deliverables:
1. `frontend/index.html`
   - nav bar
   - sections:
     - Report Lost form
     - Report Found form
2. Lost form fields:
   - `item_name`, `description`, `location`, `date`, `image` (optional)
3. Found form fields:
   - `item_name`, `description`, `location`, `date`, `image` (required)

Implementation steps:
- Create HTML forms with `enctype="multipart/form-data"` for file upload readiness.
- Add basic validation:
  - required fields for both forms (except lost image is optional)
  - date format validation (basic)
- On submit:
  - prevent default
  - call placeholder JS handlers (no backend integration yet)

Acceptance criteria:
- Pages load without errors
- Forms accept inputs and select images

### R2 - Frontend Dashboard + UI Screens
Deliverables:
1. `frontend/login.html`
2. `frontend/dashboard.html`
   - show:
     - lost items + found items (render from API later)
     - matches list (render from API later)
3. `frontend/match.html`
   - show matched pair with fields and score
   - “Start Chat” button disabled until match is available
4. `frontend/chat.html`
   - chat UI skeleton (messages list + send button)

Implementation steps:
- Create JS functions to:
  - read query parameters (e.g., `match_id`)
  - fetch data from backend later
- Keep UI simple (for exam):
  - scrollable message pane
  - timestamp display

Acceptance criteria:
- All pages render
- Navigation works

### R3 - Backend Authentication
Deliverables:
1. `backend/auth.py`
2. Add auth endpoints in `backend/app.py` (or via blueprint)

Implementation steps:
- Implement user ID generation:
  - user IDs like `U0001` using incrementing counter from `users.txt`
- Implement:
  - `POST /login`:
    - input `email_or_student_id`
    - if exists -> return existing `user_id`
    - else -> create and store in `users.txt`
- Session handling:
  - set `session['user_id']` after login
- Create helper:
  - `require_login()` to protect submission routes

Acceptance criteria:
- Logging in creates user entry or reuses existing one
- Protected routes reject unauthenticated access

### R4 - Backend Item Management
Deliverables:
1. `backend/item_routes.py`
2. Update `backend/app.py` to register routes

Implementation steps:
- Implement:
  - `POST /submit_lost`:
    - parse multipart form fields
    - handle optional image upload:
      - if image present -> save to `static/uploads/lost/{lost_id}.jpg`
      - else -> `image_path = null` or omit
    - append lost item JSON line into `database/lost.txt`
  - `POST /submit_found`:
    - similar, but image required
- Ensure server creates `static/uploads/lost/` and `static/uploads/found/` folders if missing.
- Return `lost_id` / `found_id`.

Acceptance criteria:
- Submitting forms writes correct records to `lost.txt` and `found.txt`
- Uploaded images appear on disk and are referenced by `image_path`

### R5 - AI Text Matching
Deliverables:
1. `ai/text_matching.py`

Implementation steps:
- Build stopword list.
- Implement tokenization + stopword removal.
- Implement similarity:
  - easiest: Jaccard similarity over token sets
  - optionally: TF-IDF cosine similarity
- Expose:
  - `get_text_score(desc1, desc2) -> float`

Acceptance criteria:
- Score is between 0 and 1
- Similar descriptions yield higher scores in quick manual tests

### R6 - AI Image Matching
Deliverables:
1. `ai/image_matching.py`

Implementation steps:
- Load images from `image_path`.
- Use perceptual hash or embedding cosine similarity:
  - recommend perceptual hash for speed
- Implement:
  - `get_image_score(img1_path, img2_path) -> float`
- Define behavior when one image is missing:
  - if either missing -> return 0.0 (document in code)

Acceptance criteria:
- Image similarity returns stable values
- Matching black bottle pictures yields higher similarity than unrelated images

### R7 - Matching Logic (Lost vs Found)
Deliverables:
1. `ai/matcher.py`
2. `backend/match_routes.py` route `POST /match`

Implementation steps:
- Read all items from `lost.txt` and `found.txt`.
- For each pair:
  - compute scores and final score using:
    - `final_score = 0.6 * image_score + 0.4 * text_score`
  - if `final_score >= 0.70`:
    - create match record:
      - status `pending`
      - include `score` and timestamps
    - create chat room:
      - users are the reporter IDs
    - prevent duplicates:
      - check existing matches for same lost_id and found_id
- Return matches (for UI):
  - optionally allow `GET /my_matches` or pass back new matches to frontend.

Acceptance criteria:
- `/match` produces consistent suggestions
- `matches.txt` and `chats.txt` get new entries

### R8 - Notification + Chat System
Deliverables:
1. `backend/chat_routes.py`
2. Frontend integration for `chat.html` and match start flow.

Implementation steps:
- Implement chat room creation:
  - find match -> get chat_id from `matches.txt`
- Implement chat send:
  - validate sender belongs to chat
  - append message into `messages.txt`
- Implement message retrieval:
  - return messages for chat_id ordered by `created_at`
- Notification strategy:
  - simplest: frontend dashboard calls `/my_matches` to show new match suggestions
  - optionally: store “unread” state in-memory or in text records (keep simple)

Acceptance criteria:
- After matching, users can open chat
- Messages appear in both UIs (polling acceptable for exam)

### R9 - Admin + Verification + Approve/Reject
Deliverables:
1. Admin UI page:
   - can be `frontend/admin.html` or a protected Flask template page
2. Admin endpoints:
   - view pending matches
   - approve / reject

Implementation steps:
- Admin identity:
  - simplest: a hardcoded admin login in `auth.py` for demo/PPT
  - admin_user_id = `ADMIN`
- Admin verification flow:
  - admin views:
    - match details
    - chat history (from `messages.txt`)
    - item images (from image paths)
  - admin action:
    - approve -> status `approved`
    - reject -> status `rejected`
  - record action in `admin_actions.txt`
- Item handover:
  - admin submits handover form:
    - logs to `handover.txt`
  - closes case:
    - status `resolved`

Acceptance criteria:
- Admin can approve or reject pending matches
- Case status updates correctly in `matches.txt`

### R10 - Integration + Local Testing + Repository Setup
Deliverables:
1. Integrate frontend calls with backend routes.
2. Ensure full end-to-end flow works:
   - login -> report lost/found -> match -> chat -> admin approve -> handover -> resolved
3. Testing plan:
   - test with 3 lost items and 3 found items
   - confirm expected matches above threshold (>= 0.70)
4. GitHub setup:
   - create repo
   - commit frontend, backend, ai, database templates

Acceptance criteria:
- Demo flow works without manual code changes
- All pages reflect backend outputs

## Implementation Order (Phases)
Phase 1: R1, R2, R3
- UI + login working
Phase 2: R4, R5
- lost/found reporting + text scoring working
Phase 3: R6, R7
- image scoring + matching working (`/match`)
Phase 4: R8, R9
- chat + admin approve/reject + resolved/handover
Phase 5: R10
- integration + end-to-end demo + cleanup

## Milestone Definition (What “Working” Means at Each Stage)
- “Working login”: user can log in, and server session stores user_id.
- “Working reporting”: reports appear in `lost.txt` / `found.txt`, images saved.
- “Working AI”: `get_text_score()` and `get_image_score()` return normalized scores.
- “Working matching”: matches created with correct score + threshold behavior.
- “Working chat”: matched users exchange messages and see them in UI.
- “Working admin”: pending matches can be approved/rejected and case resolves.

## Known Constraints / Simplifications (Allowed for Exam)
- Real-time chat can be implemented via polling instead of websockets.
- Text storage uses line-delimited JSON.
- Image matching can use perceptual hashing for speed.

## Next Action Once You Approve
- After you say “i am ready”, we start implementing in code following Phase 1 (R1 + R2 + R3).

