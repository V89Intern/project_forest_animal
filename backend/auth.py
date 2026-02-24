"""
auth.py — JWT helpers for Customer and User authentication
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from functools import wraps

import jwt
from flask import abort, jsonify, make_response, request

JWT_SECRET  = os.environ.get("JWT_SECRET", "change-me-in-production")
JWT_ALG     = "HS256"
CUST_EXP_H  = 8   # Customer token valid 8 hours
USER_EXP_H  = 2   # User token valid 2 hours


def create_token(sub: str, role: str, actor_type: str, hours: int) -> str:
    """Create a signed JWT."""
    now = datetime.now(tz=timezone.utc)
    payload = {
        "sub":  sub,
        "role": role,
        "type": actor_type,   # "customer" | "user"
        "iat":  now,
        "exp":  now + timedelta(hours=hours),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALG)


def _decode_token(token: str) -> dict:
    return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALG])


def _extract_payload() -> dict:
    """Extract and decode Bearer token from Authorization header."""
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        abort(make_response(jsonify({"ok": False, "error": "Missing Authorization header"}), 401))
    token = auth.split(" ", 1)[1]
    try:
        return _decode_token(token)
    except jwt.ExpiredSignatureError:
        abort(make_response(jsonify({"ok": False, "error": "Token expired"}), 401))
    except jwt.InvalidTokenError:
        abort(make_response(jsonify({"ok": False, "error": "Invalid token"}), 401))


def require_customer_jwt(f):
    """Decorator: endpoint requires a valid Customer JWT."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        payload = _extract_payload()
        if payload.get("type") != "customer":
            return jsonify({"ok": False, "error": "Customer token required"}), 403
        request.jwt_payload = payload
        return f(*args, **kwargs)
    return wrapper


def require_user_jwt(f):
    """Decorator: endpoint requires a valid User JWT."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        payload = _extract_payload()
        if payload.get("type") not in ("user", "customer"):
            return jsonify({"ok": False, "error": "User token required"}), 403
        request.jwt_payload = payload
        return f(*args, **kwargs)
    return wrapper
