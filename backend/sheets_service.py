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
_spreadsheet = None
_pin_sheet = None


def _get_spreadsheet():
    """Lazy-initialise the gspread client and return the spreadsheet object."""
    global _client, _spreadsheet

    if _spreadsheet is not None:
        return _spreadsheet

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
        _spreadsheet = _client.open_by_key(sheet_id)
        print(f"[sheets_service] Connected to Google Sheet: {_spreadsheet.title}")
    except Exception as exc:
        print(f"[sheets_service] Failed to init Google Sheets: {exc}", file=sys.stderr)
        _spreadsheet = None

    return _spreadsheet


def _get_sheet():
    """Lazy-initialise and return the first worksheet (data sheet)."""
    global _sheet
    if _sheet is not None:
        return _sheet

    spreadsheet = _get_spreadsheet()
    if spreadsheet is None:
        return None

    try:
        _sheet = spreadsheet.sheet1

        # Ensure header row exists
        existing = _sheet.row_values(1)
        expected_headers = [
            "UUID",
            "Timestamp",
            "Drawer Name",
            "Creature Name",
            "Creature Type",
            "Filename",
            "Download URL",
        ]
        if existing != expected_headers:
            _sheet.update("A1:G1", [expected_headers])
            _sheet.format("A1:G1", {"textFormat": {"bold": True}})
    except Exception as exc:
        print(f"[sheets_service] Failed to init Sheet1: {exc}", file=sys.stderr)
        _sheet = None

    return _sheet


def _get_pin_sheet():
    """Lazy-initialise and return Sheet2 (PIN login sheet).

    Sheet2 layout (row 1 = header):
        A: PIN (6-digit string)
        B: Name
    """
    global _pin_sheet
    if _pin_sheet is not None:
        return _pin_sheet

    spreadsheet = _get_spreadsheet()
    if spreadsheet is None:
        return None

    try:
        worksheets = spreadsheet.worksheets()
        if len(worksheets) < 2:
            # Auto-create Sheet2 with headers
            _pin_sheet = spreadsheet.add_worksheet(title="PINs", rows=100, cols=2)
            _pin_sheet.update("A1:B1", [["PIN", "Name"]])
            _pin_sheet.format("A1:B1", {"textFormat": {"bold": True}})
            print("[sheets_service] Created Sheet2 (PINs) with headers.")
        else:
            _pin_sheet = worksheets[1]
            existing = _pin_sheet.row_values(1)
            if existing != ["PIN", "Name"]:
                _pin_sheet.update("A1:B1", [["PIN", "Name"]])
                _pin_sheet.format("A1:B1", {"textFormat": {"bold": True}})
        print(f"[sheets_service] PIN sheet ready: {_pin_sheet.title}")
    except Exception as exc:
        print(f"[sheets_service] Failed to init PIN sheet: {exc}", file=sys.stderr)
        _pin_sheet = None

    return _pin_sheet


def verify_pin(pin: str) -> Optional[dict]:
    """Check a 6-digit PIN against Sheet2.

    Returns:
        ``{"pin": "...", "name": "..."}`` on success, ``None`` if not found.
    """
    sheet = _get_pin_sheet()
    if sheet is None:
        return None

    try:
        all_rows = sheet.get_all_values()  # includes header
        for row in all_rows[1:]:  # skip header
            if len(row) >= 2 and str(row[0]).strip() == str(pin).strip():
                return {"pin": row[0].strip(), "name": row[1].strip()}
    except Exception as exc:
        print(f"[sheets_service] PIN lookup failed: {exc}", file=sys.stderr)

    return None


def log_approved_image(
    creature_name: str,
    creature_type: str,
    filename: str,
    image_path: str,
    drawer_name: str = "",
    entity_uuid: str = "",
    base_url: Optional[str] = None,
) -> bool:
    """Append a row to the Google Sheet with the approved image metadata.

    Args:
        creature_name: Display name of the creature.
        creature_type: One of ``sky``, ``ground``, ``water``.
        filename: Final filename in ``static/animations/``.
        drawer_name: Name of the person who drew the animal.
        image_path: Absolute path on disk (not used for sheet, kept for reference).
        entity_uuid: Unique identifier for this entity.
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

    row = [entity_uuid, timestamp, drawer_name, creature_name, creature_type, filename, download_url]

    try:
        sheet.append_row(row, value_input_option="USER_ENTERED")
        print(f"[sheets_service] Logged to sheet: {filename}")
        return True
    except Exception as exc:
        print(f"[sheets_service] Failed to append row: {exc}", file=sys.stderr)
        return False
