import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Dict, Optional, Union

import cv2
import numpy as np
from rembg import remove, new_session


# Use isnet-anime model — optimized for drawn/cartoon-style images.
# Lazily initialize so API startup does not block on first model download.
_rembg_session = None

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OUTPUT_DIR = str(PROJECT_ROOT / "outputs")
STATIC_PREVIEW_FILE = PROJECT_ROOT / "static" / "rmbg_temp.png"
VALID_TYPES = {"sky", "ground", "water"}


def ensure_python_310() -> None:
    if sys.version_info[:2] < (3, 10):
        raise RuntimeError(f"Python >= 3.10 is required. Current version: {sys.version.split()[0]}")
    if sys.version_info[:2] != (3, 10):
        print(
            f"[WARN] Recommended Python is 3.10 for full compatibility. Current version: {sys.version.split()[0]}",
            file=sys.stderr,
        )


def order_points(pts: np.ndarray) -> np.ndarray:
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]
    rect[2] = pts[np.argmax(s)]
    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)]
    rect[3] = pts[np.argmax(diff)]
    return rect


def four_point_transform(image: np.ndarray, pts: np.ndarray) -> np.ndarray:
    rect = order_points(pts)
    (tl, tr, br, bl) = rect
    width_a = np.sqrt(((br[0] - bl[0]) ** 2) + ((br[1] - bl[1]) ** 2))
    width_b = np.sqrt(((tr[0] - tl[0]) ** 2) + ((tr[1] - tl[1]) ** 2))
    max_width = max(int(width_a), int(width_b))
    height_a = np.sqrt(((tr[0] - br[0]) ** 2) + ((tr[1] - br[1]) ** 2))
    height_b = np.sqrt(((tl[0] - bl[0]) ** 2) + ((tl[1] - bl[1]) ** 2))
    max_height = max(int(height_a), int(height_b))
    dst = np.array(
        [[0, 0], [max_width - 1, 0], [max_width - 1, max_height - 1], [0, max_height - 1]],
        dtype="float32",
    )
    matrix = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, matrix, (max_width, max_height))


def normalize_animal_type(animal_type: Optional[str]) -> str:
    if not animal_type:
        return "unknown"
    value = str(animal_type).strip().lower()
    return value if value in VALID_TYPES else "unknown"


def find_document_contour(frame: np.ndarray) -> Optional[np.ndarray]:
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (5, 5), 0)
    thresh = cv2.adaptiveThreshold(
        blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY_INV, 11, 2
    )
    contours, _ = cv2.findContours(thresh.copy(), cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    contours = sorted(contours, key=cv2.contourArea, reverse=True)[:5]
    for contour in contours:
        peri = cv2.arcLength(contour, True)
        approx = cv2.approxPolyDP(contour, 0.02 * peri, True)
        if len(approx) == 4 and cv2.contourArea(contour) > 15000:
            return approx
    return None


def process_frame_to_transparent(frame: np.ndarray, doc_cnt: np.ndarray) -> np.ndarray:
    warped = four_point_transform(frame, doc_cnt.reshape(4, 2))
    warped_rgb = cv2.cvtColor(warped, cv2.COLOR_BGR2RGB)
    output_rgba = remove(warped_rgb, session=get_rembg_session())
    return cv2.cvtColor(output_rgba, cv2.COLOR_RGBA2BGRA)


def get_rembg_session():
    global _rembg_session
    if _rembg_session is None:
        _rembg_session = new_session("isnet-anime")
    return _rembg_session


def process_provided_frame(
    frame: np.ndarray,
    output_dir: str = OUTPUT_DIR,
    animal_type: Optional[str] = None,
) -> Dict[str, Union[bool, str]]:
    if frame is None or frame.size == 0:
        return {"ok": False, "error": "Invalid frame data."}

    current_animal_type = normalize_animal_type(animal_type)
    doc_cnt = find_document_contour(frame)
    if doc_cnt is None:
        return {"ok": False, "error": "No document contour detected."}

    final_transparent_img = process_frame_to_transparent(frame, doc_cnt)
    filename = save_processed_image(final_transparent_img, current_animal_type, output_dir=output_dir)
    return {"ok": True, "path": filename, "type": current_animal_type}


def save_processed_image(image_bgra: np.ndarray, animal_type: str, output_dir: str = OUTPUT_DIR) -> str:
    os.makedirs(output_dir, exist_ok=True)
    safe_type = re.sub(r"[^\w\s-]", "_", str(animal_type)).strip() or "unknown"
    timestamp = int(time.time())
    filename = os.path.join(output_dir, f"{safe_type}_{timestamp}.png")
    if not cv2.imwrite(filename, image_bgra):
        raise RuntimeError("Failed to save output image.")
    return filename


def capture_and_process_single_frame(
    output_dir: str = OUTPUT_DIR,
    camera_index: int = 0,
    width: int = 1280,
    height: int = 720,
    animal_type: Optional[str] = None,
) -> Dict[str, Union[bool, str]]:
    cap = cv2.VideoCapture(camera_index)
    cap.set(3, width)
    cap.set(4, height)
    success, frame = cap.read()
    cap.release()

    if not success:
        return {"ok": False, "error": "Cannot read from webcam."}

    doc_cnt = find_document_contour(frame)
    if doc_cnt is None:
        return {"ok": False, "error": "No document contour detected."}

    return process_provided_frame(frame, output_dir=output_dir, animal_type=animal_type)


def run_scanner() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    cap = cv2.VideoCapture(0)
    cap.set(3, 1280)
    cap.set(4, 720)
    if not cap.isOpened():
        raise RuntimeError("Cannot open webcam.")

    selected_type = normalize_animal_type(os.getenv("SCANNER_DEFAULT_TYPE", "ground"))
    print("--- Digital Magic Forest Scanner (Pro Version) ---")
    print("คำแนะนำ: วางกระดาษบนพื้นสีเข้ม | กด 's' สแกน | กด 'q' ออก")

    while True:
        success, frame = cap.read()
        if not success:
            break

        display_frame = frame.copy()

        doc_cnt = find_document_contour(frame)
        if doc_cnt is not None:
            cv2.drawContours(display_frame, [doc_cnt], -1, (0, 0, 255), 3)

        cv2.imshow("Digital Magic Forest Scanner", display_frame)
        key = cv2.waitKey(1) & 0xFF

        if key == ord("s"):
            if doc_cnt is None:
                print("❌ สแกนไม่สำเร็จ: กล้องยังมองไม่เห็นกรอบสี่เหลี่ยมสีแดงรอบกระดาษ")
                continue

            print(f"⏳ เริ่มประมวลผลสัตว์ประเภท: {selected_type}...")
            print("⏳ กำลังแยกตัวสัตว์ออกจากกระดาษ...")
            final_transparent_img = process_frame_to_transparent(frame, doc_cnt)
            filename = save_processed_image(final_transparent_img, selected_type, output_dir=OUTPUT_DIR)
            print(f"✅ บันทึกสำเร็จที่: {filename}")

            try:
                STATIC_PREVIEW_FILE.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(filename, STATIC_PREVIEW_FILE)
            except Exception:
                pass

            cv2.imshow("Final Result", final_transparent_img)
            cv2.waitKey(1500)
            cv2.destroyWindow("Final Result")
        elif key == ord("q"):
            break

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    ensure_python_310()
    run_scanner()

