"""Google Sheets logging service for approved animal images.

Logs metadata (timestamp, name, type, filename, download URL) to a
Google Sheet so that users can browse and download approved images.

Required environment variables:
    GOOGLE_SHEETS_CREDENTIALS  – path to Service Account JSON file
    GOOGLE_SHEET_ID            – ID of the target Google Sheet
    APP_BASE_URL               – public base URL of the backend (for download links)
"""

from __future__ import annotations

import os
import sys
from datetime import datetime
from typing import Optional

_client = None
_sheet = None


def _get_sheet():
    """Lazy-initialise the gspread client and return the first worksheet."""
    global _client, _sheet
    if _sheet is not None:
        return _sheet

    try:
        import gspread
        from google.oauth2.service_account import Credentials
    except ImportError:
        print(
            "[sheets_service] gspread / google-auth not installed – skipping Sheet logging.",
            file=sys.stderr,
        )
        return None

    creds_path = os.getenv("GOOGLE_SHEETS_CREDENTIALS", "")
    sheet_id = os.getenv("GOOGLE_SHEET_ID", "")

    if not creds_path or not sheet_id:
        print(
            "[sheets_service] GOOGLE_SHEETS_CREDENTIALS or GOOGLE_SHEET_ID not set – skipping.",
            file=sys.stderr,
        )
        return None

    try:
        scopes = [
            "https://www.googleapis.com/auth/spreadsheets",
            "https://www.googleapis.com/auth/drive",
        ]
        credentials = Credentials.from_service_account_file(creds_path, scopes=scopes)
        _client = gspread.authorize(credentials)
        spreadsheet = _client.open_by_key(sheet_id)
        _sheet = spreadsheet.sheet1

        # Ensure header row exists
        existing = _sheet.row_values(1)
        expected_headers = [
            "Timestamp",
            "Drawer Name",
            "Creature Name",
            "Creature Type",
            "Filename",
            "Download URL",
        ]
        if existing != expected_headers:
            _sheet.update("A1:F1", [expected_headers])
            _sheet.format("A1:F1", {"textFormat": {"bold": True}})

        print(f"[sheets_service] Connected to Google Sheet: {spreadsheet.title}")
    except Exception as exc:
        print(f"[sheets_service] Failed to init Google Sheets: {exc}", file=sys.stderr)
        _sheet = None

    return _sheet


def log_approved_image(
    creature_name: str,
    creature_type: str,
    filename: str,
    image_path: str,
    drawer_name: str = "",
    base_url: Optional[str] = None,
) -> bool:
    """Append a row to the Google Sheet with the approved image metadata.

    Args:
        creature_name: Display name of the creature.
        creature_type: One of ``sky``, ``ground``, ``water``.
        filename: Final filename in ``static/animations/``.
        drawer_name: Name of the person who drew the animal.
        image_path: Absolute path on disk (not used for sheet, kept for reference).
        base_url: Public base URL override; falls back to ``APP_BASE_URL`` env.

    Returns:
        ``True`` if the row was appended successfully, ``False`` otherwise.
    """
    sheet = _get_sheet()
    if sheet is None:
        return False

    if base_url is None:
        base_url = os.getenv("APP_BASE_URL", "http://localhost:5000")
    base_url = base_url.rstrip("/")

    download_url = f"{base_url}/static/animations/{filename}"
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    row = [timestamp, drawer_name, creature_name, creature_type, filename, download_url]

    try:
        sheet.append_row(row, value_input_option="USER_ENTERED")
        print(f"[sheets_service] Logged to sheet: {filename}")
        return True
    except Exception as exc:
        print(f"[sheets_service] Failed to append row: {exc}", file=sys.stderr)
        return False
