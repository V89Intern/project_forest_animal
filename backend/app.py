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
from typing import Dict, List, Optional, Tuple
from urllib.parse import unquote, urlparse

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

QUEUE_STATUS_ACTIVE = ("QUEUED", "CAPTURING", "PROCESSING", "READY_FOR_REVIEW", "SYNCING")
queue_wakeup = threading.Event()


def normalize_phone(value: str) -> str:
    return "".join(ch for ch in str(value or "") if ch.isdigit())


def queue_counts_and_position(job_id: Optional[str] = None) -> Tuple[int, Optional[int]]:
    rows = db_query(
        """
        SELECT Job_ID
        FROM Queue_Job
        WHERE Status = ANY(%s)
        ORDER BY Create_Timestamp ASC
        """,
        (list(QUEUE_STATUS_ACTIVE),),
        fetch="all",
    ) or []
    total = len(rows)
    if not job_id:
        return total, None
    for idx, row in enumerate(rows, start=1):
        if row.get("job_id") == job_id:
            return total, idx
    return total, None


def update_job_row(job_id: str, status: str, progress: int, message: str, **extra) -> None:
    set_parts = ["Status = %s", "Progress = %s", "Message = %s", "Update_Timestamp = NOW()"]
    params: List[object] = [status, progress, message]
    field_map = {
        "detected_type": "Detected_Type",
        "preview_url": "Preview_Url",
        "filename": "Filename",
        "error": "Error_Message",
    }
    for key, col in field_map.items():
        if key in extra:
            set_parts.append(f"{col} = %s")
            params.append(extra.get(key))
    if status in {"CAPTURING", "PROCESSING"}:
        set_parts.append("Start_Timestamp = COALESCE(Start_Timestamp, NOW())")
    if status in {"DONE", "FAILED"}:
        set_parts.append("Done_Timestamp = NOW()")
    params.append(job_id)
    db_query(f"UPDATE Queue_Job SET {', '.join(set_parts)} WHERE Job_ID = %s", tuple(params))


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


def filename_from_url_path(url_path: str) -> str:
    raw = str(url_path or "").strip()
    if not raw:
        return ""
    parsed = urlparse(raw)
    path = parsed.path or raw
    if "?" in path:
        path = path.split("?", 1)[0]
    name = Path(path).name
    if not name:
        return ""
    try:
        return unquote(name)
    except Exception:
        return name


def list_latest_animations(limit: int = MAX_ITEMS, exclude_filenames: Optional[set[str]] = None) -> List[Dict[str, str]]:
    excluded = set(exclude_filenames or set())
    rows = db_query(
        """
        SELECT Url_Path, Owner_Name, Phone_Number, Upload_Timestamp
        FROM Picture_Electronic
        WHERE Url_Path ILIKE %s
        ORDER BY Upload_Timestamp DESC
        LIMIT %s
        """,
        ("%/static/animations/%", max(limit * 10, 200)),
        fetch="all",
    ) or []
    latest: List[Dict[str, str]] = []
    seen: set[str] = set()
    for row in rows:
        url_path = str(row.get("url_path") or "").strip()
        filename = filename_from_url_path(url_path)
        if not filename or filename in seen or filename in excluded:
            continue
        seen.add(filename)
        latest.append(
            {
                "filename": filename,
                "type": detect_type_from_filename(filename),
                "url": url_path,
                "owner_name": str(row.get("owner_name") or ""),
                "phone_number": str(row.get("phone_number") or ""),
            }
        )
        if len(latest) >= limit:
            break
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


def process_capture_job(job_id: str, image_data: Optional[str], requested_type: Optional[str]) -> None:
    global latest_detected_type
    RMBG_DIR.mkdir(parents=True, exist_ok=True)
    ANIMATIONS_DIR.mkdir(parents=True, exist_ok=True)
    RMBG_TEMP_FILE.parent.mkdir(parents=True, exist_ok=True)
    update_job_row(job_id, "CAPTURING", 20, "Capturing webcam frame with scanner_module...")
    update_pipeline("CAPTURING", 20, "Capturing webcam frame with scanner_module...")
    update_job_row(job_id, "PROCESSING", 65, "Running warp + RMBG pipeline...")
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
            error_msg = f"Processing failed: {result.get('error', 'unknown error')}"
            update_job_row(job_id, "FAILED", 0, error_msg, error=error_msg)
            update_pipeline("IDLE", 0, error_msg)
            return

        source_path = Path(result["path"])
        shutil.copyfile(source_path, RMBG_TEMP_FILE)

        archived_name = source_path.name
        shutil.copyfile(source_path, RMBG_DIR / archived_name)
        animal_type = result.get("type", "unknown")
        latest_detected_type = str(animal_type)
        update_job_row(
            job_id,
            "READY_FOR_REVIEW",
            100,
            f"Preview ready for approval (selected type: {animal_type}).",
            detected_type=latest_detected_type,
            preview_url="/static/rmbg_temp.png",
        )
        update_pipeline(
            "READY_FOR_REVIEW",
            100,
            f"Preview ready for approval (selected type: {animal_type}).",
            preview=RMBG_TEMP_FILE.name,
        )
        # Wait until this job is approved/failed before taking next one.
        while True:
            row = db_query("SELECT Status FROM Queue_Job WHERE Job_ID = %s", (job_id,), fetch="one")
            if not row:
                break
            if row["status"] != "READY_FOR_REVIEW":
                break
            queue_wakeup.wait(timeout=1)
            queue_wakeup.clear()
    except Exception as exc:
        latest_detected_type = None
        error_msg = f"Processing failed: {exc}"
        update_job_row(job_id, "FAILED", 0, error_msg, error=error_msg)
        update_pipeline("IDLE", 0, error_msg)


def queue_worker_loop() -> None:
    while True:
        try:
            row = db_query(
                """
                UPDATE Queue_Job
                SET Status = 'CAPTURING',
                    Progress = 20,
                    Message = 'Capturing webcam frame with scanner_module...',
                    Start_Timestamp = COALESCE(Start_Timestamp, NOW()),
                    Update_Timestamp = NOW()
                WHERE Job_ID = (
                    SELECT Job_ID
                    FROM Queue_Job
                    WHERE Status = 'QUEUED'
                    ORDER BY Create_Timestamp ASC
                    LIMIT 1
                )
                RETURNING Job_ID, Image_Path, Requested_Type
                """,
                fetch="one",
            )
            if not row:
                queue_wakeup.wait(timeout=1)
                queue_wakeup.clear()
                continue
            image_path = str(row.get("image_path") or "")
            image_data = Path(image_path).read_text(encoding="utf-8") if image_path and Path(image_path).exists() else None
            requested_type = row.get("requested_type")
            process_capture_job(str(row["job_id"]), image_data, requested_type)
        except Exception as exc:
            print(f"[ERROR] queue worker crashed on loop: {exc}", file=sys.stderr)
            time.sleep(1)


queue_worker = threading.Thread(target=queue_worker_loop, daemon=True, name="capture-queue-worker")
queue_worker.start()


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
    queue_total, _ = queue_counts_and_position(None)
    current_row = db_query(
        """
        SELECT Job_ID
        FROM Queue_Job
        WHERE Status = ANY(%s)
        ORDER BY Create_Timestamp ASC
        LIMIT 1
        """,
        (["CAPTURING", "PROCESSING", "READY_FOR_REVIEW", "SYNCING"],),
        fetch="one",
    )
    queue_current = current_row["job_id"] if current_row else None
    queue_waiting_row = db_query("SELECT COUNT(*) AS cnt FROM Queue_Job WHERE Status = 'QUEUED'", fetch="one")
    queue_waiting = int(queue_waiting_row["cnt"]) if queue_waiting_row else 0
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
                "queue_total": queue_total,
                "queue_waiting": queue_waiting,
                "queue_current_job_id": queue_current,
                "version": pipeline_version,
            }
        )


@app.post("/api/capture_process")
def capture_process():
    data = request.get_json(silent=True) or {}
    image_data = data.get("image_data")
    drawer_name = str(data.get("drawer_name", "")).strip()
    phone_number = normalize_phone(data.get("phone_number", ""))
    requester_name = str(data.get("requester_name", "")).strip()
    requested_type_raw = str(data.get("type", "")).strip().lower()
    requested_type = requested_type_raw if requested_type_raw in VALID_TYPES else None
    if requested_type_raw and requested_type is None:
        return jsonify({"ok": False, "error": "type must be sky, ground, or water"}), 400
    if not image_data:
        return jsonify({"ok": False, "error": "image_data is required"}), 400
    if len(drawer_name) < 2:
        return jsonify({"ok": False, "error": "drawer_name must be at least 2 characters"}), 400
    if len(phone_number) != 10:
        return jsonify({"ok": False, "error": "phone_number must be exactly 10 digits"}), 400
    if not requester_name:
        requester_name = drawer_name

    job_id = f"job_{uuid.uuid4().hex[:12]}"
    queue_payload_dir = OUTPUTS_DIR / "queue_jobs"
    queue_payload_dir.mkdir(parents=True, exist_ok=True)
    image_path = queue_payload_dir / f"{job_id}.txt"
    image_path.write_text(image_data, encoding="utf-8")

    db_query(
        """
        INSERT INTO Queue_Job
            (Job_ID, Status, Requested_Type, Progress, Message, Drawer_Name, Phone_Number, Requester_Name, Image_Path)
        VALUES (%s, 'QUEUED', %s, 0, 'Queued for processing.', %s, %s, %s, %s)
        """,
        (job_id, requested_type, drawer_name, phone_number, requester_name, str(image_path)),
    )
    queue_total, queue_position = queue_counts_and_position(job_id)
    queue_wakeup.set()
    return jsonify(
        {
            "ok": True,
            "message": "Capture queued.",
            "job_id": job_id,
            "queue_position": queue_position,
            "queue_total": queue_total,
        }
    )


@app.get("/api/queue_status/<job_id>")
def queue_status(job_id: str):
    job = db_query(
        """
        SELECT Job_ID, Status, Progress, Message, Requested_Type, Drawer_Name, Phone_Number, Requester_Name,
               Detected_Type, Preview_Url, Filename, Error_Message, Create_Timestamp, Update_Timestamp
        FROM Queue_Job
        WHERE Job_ID = %s
        """,
        (job_id,),
        fetch="one",
    )
    if not job:
        return jsonify({"ok": False, "error": "Job not found"}), 404
    queue_total, queue_position = queue_counts_and_position(job_id)
    return jsonify(
        {
            "ok": True,
            "job_id": job["job_id"],
            "state": job["status"],
            "progress": job["progress"],
            "message": job["message"],
            "queue_position": queue_position,
            "queue_total": queue_total,
            "detected_type": job["detected_type"],
            "preview_url": job["preview_url"],
            "filename": job["filename"],
            "error": job["error_message"],
            "drawer_name": job["drawer_name"],
            "phone_number": job["phone_number"],
            "requester_name": job["requester_name"],
        }
    )


@app.get("/api/queue_jobs")
@require_customer_jwt
def queue_jobs():
    limit = min(max(int(request.args.get("limit", 200)), 1), 500)
    status = str(request.args.get("status", "")).strip().upper()
    if status:
        rows = db_query(
            """
            SELECT Job_ID, Status, Progress, Message, Requested_Type, Drawer_Name, Phone_Number, Requester_Name,
                   Detected_Type, Preview_Url, Filename, Error_Message, Create_Timestamp, Update_Timestamp
            FROM Queue_Job
            WHERE Status = %s
            ORDER BY Create_Timestamp DESC
            LIMIT %s
            """,
            (status, limit),
            fetch="all",
        ) or []
    else:
        rows = db_query(
            """
            SELECT Job_ID, Status, Progress, Message, Requested_Type, Drawer_Name, Phone_Number, Requester_Name,
                   Detected_Type, Preview_Url, Filename, Error_Message, Create_Timestamp, Update_Timestamp
            FROM Queue_Job
            ORDER BY Create_Timestamp DESC
            LIMIT %s
            """,
            (limit,),
            fetch="all",
        ) or []

    active_rows = db_query(
        """
        SELECT Job_ID
        FROM Queue_Job
        WHERE Status = ANY(%s)
        ORDER BY Create_Timestamp ASC
        """,
        (list(QUEUE_STATUS_ACTIVE),),
        fetch="all",
    ) or []
    pos_map = {row["job_id"]: idx for idx, row in enumerate(active_rows, start=1)}
    queue_total = len(active_rows)
    items = []
    for row in rows:
        item = dict(row)
        item["queue_position"] = pos_map.get(item["job_id"])
        item["queue_total"] = queue_total
        items.append(item)
    return jsonify({"ok": True, "count": len(items), "items": items})


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
    job_id = str(data.get("job_id", "")).strip()
    creature_type = str(data.get("type", "ground")).lower()
    creature_name = str(data.get("name", "")).strip() or f"{creature_type}_creature"
    drawer_name = str(data.get("drawer_name", "")).strip()
    phone_number = normalize_phone(data.get("phone_number", ""))
    if creature_type not in VALID_TYPES:
        return jsonify({"ok": False, "error": "type must be sky, ground, or water"}), 400
    if len(drawer_name) < 2:
        return jsonify({"ok": False, "error": "drawer_name must be at least 2 characters"}), 400
    if len(phone_number) != 10:
        return jsonify({"ok": False, "error": "phone_number must be exactly 10 digits"}), 400
    if len(creature_name.strip()) < 2:
        return jsonify({"ok": False, "error": "name must be at least 2 characters"}), 400
    if job_id:
        job = db_query(
            "SELECT Job_ID, Status, Drawer_Name, Phone_Number FROM Queue_Job WHERE Job_ID = %s",
            (job_id,),
            fetch="one",
        )
    else:
        job = db_query(
            """
            SELECT Job_ID, Status, Drawer_Name, Phone_Number
            FROM Queue_Job
            WHERE Status = 'READY_FOR_REVIEW'
            ORDER BY Create_Timestamp ASC
            LIMIT 1
            """,
            fetch="one",
        )
    if not job:
        return jsonify({"ok": False, "error": "No job waiting for approval."}), 409
    target_job_id = str(job["job_id"])
    if job["status"] != "READY_FOR_REVIEW":
        total, position = queue_counts_and_position(target_job_id)
        return jsonify({"ok": False, "error": "Job is not ready for approval.", "queue_position": position, "queue_total": total}), 409
    if not RMBG_TEMP_FILE.exists():
        return jsonify({"ok": False, "error": "No temp file to approve."}), 404

    ANIMATIONS_DIR.mkdir(parents=True, exist_ok=True)
    entity_uuid = str(uuid.uuid4())
    # Include milliseconds + short uuid to avoid filename collisions in the same second.
    final_name = f"{creature_type}_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')[:-3]}_{uuid.uuid4().hex[:6]}.png"
    final_path = ANIMATIONS_DIR / final_name
    shutil.move(str(RMBG_TEMP_FILE), str(final_path))

    # Log to PostgreSQL. If DB write fails, rollback file move and return error.
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
        if final_path.exists():
            shutil.move(str(final_path), str(RMBG_TEMP_FILE))
        update_job_row(target_job_id, "READY_FOR_REVIEW", 100, "DB save failed. Please retry approve.", error=str(exc))
        update_pipeline("READY_FOR_REVIEW", 100, "DB save failed. Please retry approve.")
        print(f"[ERROR] DB approve insert failed: {exc}", file=sys.stderr)
        return jsonify({"ok": False, "error": "Database insert failed. Please retry approve."}), 500

    update_job_row(
        target_job_id,
        "DONE",
        100,
        f"Approved: {final_name}",
        filename=final_name,
    )
    queue_wakeup.set()

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
    """Delete a single animal animation file + DB records by filename."""
    safe_name = Path(filename).name           # strip any path traversal
    db_deleted = db_query(
        """
        DELETE FROM Picture_Electronic
        WHERE Url_Path = %s OR Url_Path ILIKE %s
        RETURNING PE_ID
        """,
        (f"/static/animations/{safe_name}", f"%/{safe_name}"),
        fetch="all",
    ) or []
    file_path = ANIMATIONS_DIR / safe_name
    file_deleted = False
    if file_path.exists() and file_path.is_file():
        file_path.unlink(missing_ok=True)
        file_deleted = True
    if not db_deleted and not file_deleted:
        return jsonify({"ok": False, "error": "File not found"}), 404
    # Remove from active entities list if present
    active_entities[:] = [e for e in active_entities if e.get("filename") != safe_name]
    return jsonify({"ok": True, "deleted": safe_name, "db_deleted": len(db_deleted), "file_deleted": file_deleted})


@app.post("/api/animals/delete_many")
def delete_many_animals():
    """Delete multiple animal files + DB records by filename list."""
    data = request.get_json(silent=True) or {}
    filenames = data.get("filenames", [])
    if not isinstance(filenames, list) or len(filenames) == 0:
        return jsonify({"ok": False, "error": "filenames list is required"}), 400

    deleted, not_found = [], []
    db_removed_total = 0
    for fn in filenames:
        safe_name = Path(fn).name
        db_deleted = db_query(
            """
            DELETE FROM Picture_Electronic
            WHERE Url_Path = %s OR Url_Path ILIKE %s
            RETURNING PE_ID
            """,
            (f"/static/animations/{safe_name}", f"%/{safe_name}"),
            fetch="all",
        ) or []
        db_removed_total += len(db_deleted)
        file_path = ANIMATIONS_DIR / safe_name
        file_deleted = False
        if file_path.exists() and file_path.is_file():
            file_path.unlink(missing_ok=True)
            file_deleted = True
        if db_deleted or file_deleted:
            if safe_name not in deleted:
                deleted.append(safe_name)
        else:
            not_found.append(safe_name)
    active_entities[:] = [e for e in active_entities if e.get("filename") not in deleted]
    return jsonify({"ok": True, "deleted": deleted, "not_found": not_found, "db_deleted": db_removed_total})


@app.post("/api/clear_forest")
def clear_forest():
    global forest_rendered_entities, forest_last_seen_ts
    ANIMATIONS_DIR.mkdir(parents=True, exist_ok=True)
    removed = 0
    for path in ANIMATIONS_DIR.iterdir():
        if path.is_file():
            path.unlink(missing_ok=True)
            removed += 1
    db_removed_rows = db_query(
        """
        DELETE FROM Picture_Electronic
        WHERE Url_Path ILIKE %s
        RETURNING PE_ID
        """,
        ("%/static/animations/%",),
        fetch="all",
    ) or []
    db_removed = len(db_removed_rows)
    active_entities.clear()
    forest_rendered_entities = []
    forest_last_seen_ts = time.time()
    update_pipeline("IDLE", 0, f"Forest cleared. Removed {removed} files and {db_removed} DB rows.")
    return jsonify({"ok": True, "removed_files": removed, "removed_db": db_removed})


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


UPLOADS_DIR = STATIC_DIR / "uploads"


@app.post("/api/register")
def register_with_image():
    """
    Register a user with name, phone, PDPA consent, and an uploaded image.
    Accepts multipart/form-data:
        - name:  display name (required)
        - phone: phone number (required)
        - pdpa:  'true' | '1' (required)
        - image: image file (required)
    Returns JSON with ok, message, and saved filename.
    """
    name  = request.form.get("name",  "").strip()
    phone = request.form.get("phone", "").strip()
    pdpa_raw = request.form.get("pdpa", "false").strip().lower()
    pdpa = pdpa_raw in ("true", "1", "yes")

    if not name:
        return jsonify({"ok": False, "error": "ชื่อเป็นข้อมูลที่จำเป็น"}), 400
    if not phone:
        return jsonify({"ok": False, "error": "เบอร์โทรเป็นข้อมูลที่จำเป็น"}), 400
    if not pdpa:
        return jsonify({"ok": False, "error": "กรุณายอมรับ PDPA ก่อนดำเนินการ"}), 400

    image_file = request.files.get("image")
    if image_file is None or image_file.filename == "":
        return jsonify({"ok": False, "error": "กรุณาอัปโหลดรูปภาพ"}), 400

    # Validate file extension
    allowed_exts = {".jpg", ".jpeg", ".png", ".gif", ".webp"}
    ext = Path(image_file.filename).suffix.lower()
    if ext not in allowed_exts:
        return jsonify({"ok": False, "error": f"ไฟล์ {ext} ไม่รองรับ (รองรับ JPG, PNG, GIF, WEBP)"}), 400

    UPLOADS_DIR.mkdir(parents=True, exist_ok=True)
    ts  = datetime.now().strftime("%Y%m%d_%H%M%S")
    uid = str(uuid.uuid4())[:8]
    saved_name = f"reg_{ts}_{uid}{ext}"
    save_path  = UPLOADS_DIR / saved_name
    image_file.save(str(save_path))

    url_path = f"/static/uploads/{saved_name}"

    try:
        db_query(
            """
            INSERT INTO Picture_Electronic
              (Url_Path, Phone_Number, Owner_Name, Uploader_ID, Uploader_Type)
            VALUES (%s, %s, %s, %s, 'USER')
            """,
            (url_path, phone, name, 0),
        )
    except Exception as exc:
        print(f"[WARN] DB register log skipped: {exc}", file=sys.stderr)

    return jsonify({
        "ok":      True,
        "message": f"ลงทะเบียนสำเร็จ! ยินดีต้อนรับ {name}",
        "filename": saved_name,
        "url":     url_path,
    }), 201


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
