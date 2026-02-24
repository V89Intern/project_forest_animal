from datetime import datetime
from pathlib import Path
import base64
import mimetypes
import os
import random
import shutil
import threading
import time
import sys
import uuid
from typing import Dict, List, Optional

from dotenv import load_dotenv

# Load .env from backend/ directory
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(_env_path)

from flask import Flask, Response, abort, jsonify, request, send_from_directory
from flask_cors import CORS
import cv2
import numpy as np

from backend.scanner_module import (
    capture_and_process_single_frame,
    process_provided_frame,
)
from backend.db import init_db, query as db_query
from backend.auth import (
    create_token, require_customer_jwt, require_user_jwt,
    CUST_EXP_H, USER_EXP_H
)




PROJECT_ROOT = Path(__file__).resolve().parents[1]
STATIC_DIR = PROJECT_ROOT / "static"
OUTPUTS_DIR = PROJECT_ROOT / "outputs"
ANIMATIONS_DIR = STATIC_DIR / "animations"
RMBG_DIR = OUTPUTS_DIR / "rmbg"
RMBG_TEMP_FILE = STATIC_DIR / "rmbg_temp.png"

MAX_ITEMS = 10
VALID_TYPES = {"sky", "ground", "water"}
PIPELINE_STATES = {"IDLE", "CAPTURING", "PROCESSING", "READY_FOR_REVIEW", "SYNCING"}

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("text/css", ".css")

app = Flask(__name__, static_folder=None)
CORS(app)

# Initialise database (idempotent DDL + seed)
try:
    init_db()
except Exception as _db_exc:
    print(f"[WARN] DB init failed: {_db_exc}", file=sys.stderr)

pipeline_lock = threading.Lock()
pipeline_state = "IDLE"
pipeline_progress = 0
pipeline_message = "Ready"
latest_preview_file: Optional[str] = None
latest_detected_type: Optional[str] = None
active_entities: List[Dict[str, str]] = []
forest_rendered_entities: List[str] = []
forest_last_seen_ts: float = 0.0
pipeline_version = 0
pipeline_cond = threading.Condition(pipeline_lock)


def ensure_python_310() -> None:
    if sys.version_info[:2] < (3, 10):
        raise RuntimeError(f"Python >= 3.10 is required. Current version: {sys.version.split()[0]}")
    if sys.version_info[:2] != (3, 10):
        print(
            f"[WARN] Recommended Python is 3.10 for full compatibility. Current version: {sys.version.split()[0]}",
            file=sys.stderr,
        )


def detect_type_from_filename(filename: str) -> str:
    prefix = filename.split("_", 1)[0].lower()
    if prefix in VALID_TYPES:
        return prefix
    return "unknown"


def list_latest_animations(limit: int = MAX_ITEMS) -> List[Dict[str, str]]:
    ANIMATIONS_DIR.mkdir(parents=True, exist_ok=True)
    files = [p for p in ANIMATIONS_DIR.iterdir() if p.is_file()]
    files.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    latest = []
    for path in files[:limit]:
        latest.append(
            {
                "filename": path.name,
                "type": detect_type_from_filename(path.name),
                "url": f"/static/animations/{path.name}",
            }
        )
    return latest


def update_pipeline(state: str, progress: int, message: str, preview: Optional[str] = None) -> None:
    global pipeline_state, pipeline_progress, pipeline_message, latest_preview_file, pipeline_version
    if state not in PIPELINE_STATES:
        raise ValueError(f"Unknown pipeline state: {state}")
    with pipeline_lock:
        pipeline_state = state
        pipeline_progress = progress
        pipeline_message = message
        if preview is not None:
            latest_preview_file = preview
        pipeline_version += 1
        pipeline_cond.notify_all()


def run_capture_process(image_data: Optional[str] = None, requested_type: Optional[str] = None) -> None:
    global latest_detected_type
    RMBG_DIR.mkdir(parents=True, exist_ok=True)
    ANIMATIONS_DIR.mkdir(parents=True, exist_ok=True)
    RMBG_TEMP_FILE.parent.mkdir(parents=True, exist_ok=True)
    update_pipeline("CAPTURING", 20, "Capturing webcam frame with scanner_module...")
    update_pipeline("PROCESSING", 65, "Running warp + RMBG pipeline...")
    try:
        if image_data:
            payload = image_data.split(",", 1)[1] if "," in image_data else image_data
            raw = base64.b64decode(payload)
            arr = np.frombuffer(raw, dtype=np.uint8)
            frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
            result = process_provided_frame(frame, output_dir=str(OUTPUTS_DIR), animal_type=requested_type)
        else:
            result = capture_and_process_single_frame(output_dir=str(OUTPUTS_DIR), animal_type=requested_type)

        if not result.get("ok"):
            latest_detected_type = None
            update_pipeline("IDLE", 0, f"Processing failed: {result.get('error', 'unknown error')}")
            return

        source_path = Path(result["path"])
        shutil.copyfile(source_path, RMBG_TEMP_FILE)

        archived_name = source_path.name
        shutil.copyfile(source_path, RMBG_DIR / archived_name)
        animal_type = result.get("type", "unknown")
        latest_detected_type = str(animal_type)
        update_pipeline(
            "READY_FOR_REVIEW",
            100,
            f"Preview ready for approval (selected type: {animal_type}).",
            preview=RMBG_TEMP_FILE.name,
        )
    except Exception as exc:
        latest_detected_type = None
        update_pipeline("IDLE", 0, f"Processing failed: {exc}")


@app.after_request
def enforce_static_mime_types(response):
    path = request.path.lower()
    if path.endswith(".js") or path.endswith(".mjs"):
        response.headers["Content-Type"] = "application/javascript; charset=utf-8"
    elif path.endswith(".css"):
        response.headers["Content-Type"] = "text/css; charset=utf-8"
    return response


@app.get("/")
def root():
    return jsonify(
        {
            "service": "digital-magic-forest-api",
            "status": "ok",
            "version": "1.0",
            "routes": {
                "health": "/health",
                "latest_animals": "/api/latest_animals",
                "pipeline_status": "/api/pipeline_status",
            },
        }
    )


@app.get("/health")
def health():
    return jsonify({"ok": True, "service": "digital-magic-forest-api"})


@app.get("/static/<path:filename>", endpoint="static")
def serve_static(filename: str):
    file_path = STATIC_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        abort(404)

    suffix = file_path.suffix.lower()
    if suffix in {".js", ".mjs"}:
        content_type = "application/javascript; charset=utf-8"
    elif suffix == ".css":
        content_type = "text/css; charset=utf-8"
    else:
        guessed, _ = mimetypes.guess_type(str(file_path))
        content_type = guessed or "application/octet-stream"
    return Response(file_path.read_bytes(), content_type=content_type)


@app.get("/api/latest_animals")
def latest_animals():
    return jsonify({"items": list_latest_animations(MAX_ITEMS)})


@app.get("/api/pipeline_status")
def pipeline_status():
    with pipeline_lock:
        wait = request.args.get("wait") == "1"
        timeout = min(max(float(request.args.get("timeout", 20)), 1), 30)
        since = int(request.args.get("since", 0))
        if wait and pipeline_version <= since:
            pipeline_cond.wait(timeout=timeout)
        forest_online = (time.time() - forest_last_seen_ts) < 8
        active_count = len(forest_rendered_entities) if forest_online else len(active_entities)
        preview_url = "/static/rmbg_temp.png" if RMBG_TEMP_FILE.exists() else None
        return jsonify(
            {
                "state": pipeline_state,
                "progress": pipeline_progress,
                "message": pipeline_message,
                "preview_url": preview_url,
                "detected_type": latest_detected_type,
                "active_entities": active_count,
                "active_entities_source": "forest" if forest_online else "backend",
                "version": pipeline_version,
            }
        )


@app.post("/api/capture_process")
def capture_process():
    with pipeline_lock:
        if pipeline_state in {"CAPTURING", "PROCESSING", "SYNCING"}:
            return jsonify({"ok": False, "error": "Pipeline is busy."}), 409

    data = request.get_json(silent=True) or {}
    image_data = data.get("image_data")
    requested_type_raw = str(data.get("type", "")).strip().lower()
    requested_type = requested_type_raw if requested_type_raw in VALID_TYPES else None
    if requested_type_raw and requested_type is None:
        return jsonify({"ok": False, "error": "type must be sky, ground, or water"}), 400
    thread = threading.Thread(
        target=run_capture_process,
        kwargs={"image_data": image_data, "requested_type": requested_type},
        daemon=True,
    )
    thread.start()
    return jsonify({"ok": True, "message": "Capture and process started."})


# ─── Auth — Customer ────────────────────────────────────────────────────────
@app.post("/api/auth/customer/login")
def customer_login():
    """Verify a 6-digit PIN against the Customer table; return JWT."""
    data = request.get_json(silent=True) or {}
    pin  = str(data.get("pin", "")).strip()

    if not pin or len(pin) != 6 or not pin.isdigit():
        return jsonify({"ok": False, "error": "PIN ต้องเป็นตัวเลข 6 หลัก"}), 400

    row = db_query(
        "SELECT Customer_ID, Name, Role_ID FROM Customer WHERE PIN = %s",
        (pin,), fetch="one"
    )
    if row is None:
        return jsonify({"ok": False, "error": "PIN ไม่ถูกต้อง"}), 401

    token = create_token(
        sub=str(row["customer_id"]),
        role=str(row["role_id"]),
        actor_type="customer",
        hours=CUST_EXP_H,
    )
    return jsonify({"ok": True, "token": token, "name": row["name"]})


# Backward-compat alias (old /api/login still works)
@app.post("/api/login")
def legacy_login():
    return customer_login()


# ─── Auth — User ─────────────────────────────────────────────────────────────
@app.post("/api/auth/user/register")
def user_register():
    """Register a new public user; return JWT."""
    data  = request.get_json(silent=True) or {}
    phone = str(data.get("phone", "")).strip()
    pdpa  = bool(data.get("pdpa", False))

    if not phone:
        return jsonify({"ok": False, "error": "phone is required"}), 400
    if not pdpa:
        return jsonify({"ok": False, "error": "PDPA consent required"}), 400

    # role_id 3 = 'USER'
    # Generate a unique 3-digit User_ID (000-999)

    for _ in range(50):
        uid = f"{random.randint(0, 999):03d}"
        existing = db_query(
            "SELECT 1 FROM Users WHERE User_ID = %s", (uid,), fetch="one"
        )
        if not existing:
            break
    else:
        return jsonify({"ok": False, "error": "ไม่สามารถสร้าง User ID ได้ (เต็ม)"}), 500

    row = db_query(
        """
        INSERT INTO Users (User_ID, Phone_Number, PDPA_Check, Role_ID)
        VALUES (%s, %s, %s, 3)
        RETURNING User_ID, Role_ID
        """,
        (uid, phone, pdpa), fetch="one"
    )
    token = create_token(
        sub=str(row["user_id"]),
        role=str(row["role_id"]),
        actor_type="user",
        hours=USER_EXP_H,
    )
    return jsonify({"ok": True, "token": token, "user_id": uid})


@app.post("/api/auth/user/login")
def user_login():
    """Return JWT for an existing user by phone number."""
    data  = request.get_json(silent=True) or {}
    phone = str(data.get("phone", "")).strip()
    if not phone:
        return jsonify({"ok": False, "error": "phone is required"}), 400

    row = db_query(
        "SELECT User_ID, Role_ID FROM Users WHERE Phone_Number = %s ORDER BY Create_Timestamp DESC LIMIT 1",
        (phone,), fetch="one"
    )
    if row is None:
        return jsonify({"ok": False, "error": "ไม่พบผู้ใช้"}), 404

    token = create_token(
        sub=str(row["user_id"]),
        role=str(row["role_id"]),
        actor_type="user",
        hours=USER_EXP_H,
    )
    return jsonify({"ok": True, "token": token})


# ─── Customer Management ──────────────────────────────────────────────────────
@app.get("/api/customers")
@require_customer_jwt
def list_customers():
    """List all customers (masked PIN, Customer JWT required)."""
    rows = db_query(
        """
        SELECT c.Customer_ID, c.Name, c.Role_ID, r.Role_Name,
               LEFT(c.PIN, 2) || '****' AS pin_masked
        FROM Customer c
        LEFT JOIN Role r ON c.Role_ID = r.Role_ID
        ORDER BY c.Customer_ID
        """,
        fetch="all"
    )
    return jsonify({"ok": True, "customers": [dict(r) for r in (rows or [])]})


@app.post("/api/customers")
@require_customer_jwt
def add_customer():
    """Add a new customer (PIN must be 6 digits and unique)."""
    data = request.get_json(silent=True) or {}
    pin  = str(data.get("pin", "")).strip()
    name = str(data.get("name", "")).strip()
    role_id = int(data.get("role_id", 1))

    if not pin or len(pin) != 6 or not pin.isdigit():
        return jsonify({"ok": False, "error": "PIN ต้องเป็นตัวเลข 6 หลัก"}), 400
    if not name:
        return jsonify({"ok": False, "error": "name is required"}), 400

    # Check PIN uniqueness
    existing = db_query("SELECT 1 FROM Customer WHERE PIN = %s", (pin,), fetch="one")
    if existing:
        return jsonify({"ok": False, "error": "PIN นี้ถูกใช้แล้ว"}), 409

    row = db_query(
        "INSERT INTO Customer (PIN, Name, Role_ID) VALUES (%s, %s, %s) RETURNING Customer_ID",
        (pin, name, role_id), fetch="one"
    )
    return jsonify({"ok": True, "customer_id": row["customer_id"], "name": name}), 201


@app.delete("/api/customers/<int:customer_id>")
@require_customer_jwt
def delete_customer(customer_id: int):
    """Delete a customer by ID (cannot delete yourself)."""
    caller_id = int(request.jwt_payload.get("sub", -1))
    if caller_id == customer_id:
        return jsonify({"ok": False, "error": "ไม่สามารถลบบัญชีตัวเองได้"}), 403

    row = db_query("SELECT Name FROM Customer WHERE Customer_ID = %s", (customer_id,), fetch="one")
    if row is None:
        return jsonify({"ok": False, "error": "Customer not found"}), 404

    db_query("DELETE FROM Customer WHERE Customer_ID = %s", (customer_id,))
    return jsonify({"ok": True, "deleted": row["name"]})


@app.post("/api/spawn")
def spawn():
    data = request.get_json(silent=True) or {}
    creature_type = str(data.get("type", "")).lower()
    creature_name = str(data.get("name", "")).strip()

    if creature_type not in VALID_TYPES:
        return jsonify({"ok": False, "error": "type must be sky, ground, or water"}), 400
    if not creature_name:
        return jsonify({"ok": False, "error": "name is required"}), 400

    update_pipeline("SYNCING", 100, "Syncing spawn to main display...")
    entity = {
        "id": f"ent_{int(time.time() * 1000)}",
        "name": creature_name,
        "type": creature_type,
        "created_at": datetime.now().isoformat(),
    }
    active_entities.append(entity)
    update_pipeline("IDLE", 0, f"Spawned {creature_name} ({creature_type}).")
    return jsonify({"ok": True, "entity": entity})


@app.post("/api/approve")
def approve():
    data = request.get_json(silent=True) or {}
    creature_type = str(data.get("type", "ground")).lower()
    creature_name = str(data.get("name", "")).strip() or f"{creature_type}_creature"
    drawer_name = str(data.get("drawer_name", "")).strip()
    phone_number = str(data.get("phone_number", "")).strip()
    if creature_type not in VALID_TYPES:
        return jsonify({"ok": False, "error": "type must be sky, ground, or water"}), 400
    if not RMBG_TEMP_FILE.exists():
        return jsonify({"ok": False, "error": "No temp file to approve."}), 404

    ANIMATIONS_DIR.mkdir(parents=True, exist_ok=True)
    entity_uuid = str(uuid.uuid4())
    final_name = f"{creature_type}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    final_path = ANIMATIONS_DIR / final_name
    shutil.move(str(RMBG_TEMP_FILE), str(final_path))

    # Log to PostgreSQL
    try:
        db_query(
            """
            INSERT INTO Picture_Electronic
              (Url_Path, Phone_Number, Owner_Name, Uploader_ID, Uploader_Type)
            VALUES (%s, %s, %s, %s, 'CUSTOMER')
            """,
            (
                f"/static/animations/{final_name}",
                phone_number,
                drawer_name or creature_name,
                0,                   # system/unknown uploader
            )
        )
    except Exception as exc:
        print(f"[WARN] DB approve log skipped: {exc}", file=sys.stderr)

    update_pipeline("SYNCING", 100, "Approved and syncing creature to forest...")
    entity = {
        "id": f"ent_{int(time.time() * 1000)}",
        "name": creature_name,
        "type": creature_type,
        "created_at": datetime.now().isoformat(),
        "filename": final_name,
    }
    active_entities.append(entity)
    update_pipeline("IDLE", 0, f"Approved: {final_name}")
    return jsonify(
        {
            "ok": True,
            "filename": final_name,
            "url": f"/static/animations/{final_name}",
            "entity": entity,
            "active_entities": len(active_entities),
        }
    )


@app.post("/api/kill")
def kill_all():
    active_entities.clear()
    update_pipeline("IDLE", 0, "Kill switch activated. All entities cleared.")
    return jsonify({"ok": True, "message": "All active entities cleared."})


@app.delete("/api/animals/<path:filename>")
def delete_animal(filename: str):
    """Delete a single animal animation file by filename."""
    safe_name = Path(filename).name           # strip any path traversal
    file_path = ANIMATIONS_DIR / safe_name
    if not file_path.exists() or not file_path.is_file():
        return jsonify({"ok": False, "error": "File not found"}), 404
    file_path.unlink(missing_ok=True)
    # Remove from active entities list if present
    active_entities[:] = [e for e in active_entities if e.get("filename") != safe_name]
    return jsonify({"ok": True, "deleted": safe_name})


@app.post("/api/animals/delete_many")
def delete_many_animals():
    """Delete multiple animal files by a list of filenames."""
    data = request.get_json(silent=True) or {}
    filenames = data.get("filenames", [])
    if not isinstance(filenames, list) or len(filenames) == 0:
        return jsonify({"ok": False, "error": "filenames list is required"}), 400

    deleted, not_found = [], []
    for fn in filenames:
        safe_name = Path(fn).name
        file_path = ANIMATIONS_DIR / safe_name
        if file_path.exists() and file_path.is_file():
            file_path.unlink(missing_ok=True)
            deleted.append(safe_name)
        else:
            not_found.append(safe_name)
    active_entities[:] = [e for e in active_entities if e.get("filename") not in deleted]
    return jsonify({"ok": True, "deleted": deleted, "not_found": not_found})


@app.post("/api/clear_forest")
def clear_forest():
    global forest_rendered_entities, forest_last_seen_ts
    ANIMATIONS_DIR.mkdir(parents=True, exist_ok=True)
    removed = 0
    for path in ANIMATIONS_DIR.iterdir():
        if path.is_file():
            path.unlink(missing_ok=True)
            removed += 1
    active_entities.clear()
    forest_rendered_entities = []
    forest_last_seen_ts = time.time()
    update_pipeline("IDLE", 0, f"Forest cleared. Removed {removed} animation files.")
    return jsonify({"ok": True, "removed": removed})


@app.post("/api/forest_state")
def forest_state():
    global forest_rendered_entities, forest_last_seen_ts
    data = request.get_json(silent=True) or {}
    rendered = data.get("rendered", [])
    if not isinstance(rendered, list):
        return jsonify({"ok": False, "error": "rendered must be a list"}), 400

    normalized = []
    seen = set()
    for item in rendered:
        if not isinstance(item, str):
            continue
        if item in seen:
            continue
        normalized.append(item)
        seen.add(item)

    with pipeline_lock:
        forest_rendered_entities = normalized
        forest_last_seen_ts = time.time()

    return jsonify({"ok": True, "count": len(forest_rendered_entities)})


@app.get("/outputs/rmbg/<path:filename>")
def serve_rmbg(filename: str):
    return send_from_directory(RMBG_DIR, filename)


# ─── Pictures (replaces /api/gallery) ───────────────────────────────────────
@app.get("/api/pictures")
@require_user_jwt
def pictures():
    """
    Customer JWT  → can see all pictures (optionally filter by phone / type).
    User JWT      → can only see pictures matching their own registered phone.
    """
    payload = request.jwt_payload
    actor_type = payload.get("type")

    phone_filter   = request.args.get("phone", "").strip()
    owner_filter   = request.args.get("owner", "").strip()

    conditions = []
    params: list = []

    if actor_type == "user":
        # Users can only query their own phone
        user_row = db_query(
            "SELECT Phone_Number FROM Users WHERE User_ID = %s",
            (payload["sub"],), fetch="one"
        )
        own_phone = user_row["phone_number"] if user_row else ""
        conditions.append("Phone_Number = %s")
        params.append(own_phone)
    else:
        # Customer can filter freely
        if phone_filter:
            conditions.append("Phone_Number = %s")
            params.append(phone_filter)

    if owner_filter:
        conditions.append("Owner_Name ILIKE %s")
        params.append(f"%{owner_filter}%")

    where = ("WHERE " + " AND ".join(conditions)) if conditions else ""
    rows = db_query(
        f"""
        SELECT PE_ID, Url_Path, Phone_Number, Owner_Name,
               Uploader_ID, Uploader_Type, Upload_Timestamp
        FROM Picture_Electronic
        {where}
        ORDER BY Upload_Timestamp DESC
        LIMIT 200
        """,
        params or None, fetch="all"
    )
    return jsonify({"ok": True, "count": len(rows), "pictures": [dict(r) for r in (rows or [])]})


# Backward-compat alias for old gallery endpoint
@app.get("/api/gallery")
@require_user_jwt
def gallery():
    return pictures()


@app.get("/api/download/<path:filename>")
def download_animation(filename: str):
    """Download an animation image as an attachment."""
    file_path = ANIMATIONS_DIR / filename
    if not file_path.exists() or not file_path.is_file():
        abort(404)
    return send_from_directory(ANIMATIONS_DIR, filename, as_attachment=True)


if __name__ == "__main__":
    ensure_python_310()
    app.run(host="0.0.0.0", port=5000, debug=os.getenv("FLASK_DEBUG", "0") == "1")
