import os
import re
import shutil
import sys
import time
from pathlib import Path
from typing import Dict, Optional, Union
import glob

import cv2
import numpy as np
from rembg import remove, new_session


# Use u2net model — general-purpose, detects objects by shape/outline even with faint colors.
# Better than isnet-anime for children's drawings with light coloring.
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


def _auto_adjust_brightness(image_rgb: np.ndarray) -> np.ndarray:
    """
    AI Auto Brightness: วิเคราะห์ Histogram ของภาพเพื่อปรับแสงอัตโนมัติ
    - ภาพมืดเกิน → เพิ่มแสงแรงๆ (gamma ต่ำ, beta สูง)
    - ภาพสว่างเกิน → ลดแสงลง (gamma สูง, beta ต่ำ)
    - ภาพปกติ → ปรับนิดหน่อย
    """
    # วิเคราะห์ความสว่างเฉลี่ยของภาพ (ใช้ Grayscale)
    gray = cv2.cvtColor(image_rgb, cv2.COLOR_RGB2GRAY)
    mean_brightness = np.mean(gray)
    
    # ตัดสินใจเลือกค่าปรับแสงตามสภาพของภาพ
    if mean_brightness < 80:
        # 🌑 ภาพมืดมาก → เพิ่มแสงแรงสุดๆ
        gamma = 0.5
        alpha = 1.5
        beta = 50
        label = "DARK"
    elif mean_brightness < 120:
        # 🌤 ภาพค่อนข้างมืด → เพิ่มแสงปานกลาง
        gamma = 0.65
        alpha = 1.3
        beta = 30
        label = "DIM"
    elif mean_brightness < 180:
        # ☀️ ภาพปกติ → ปรับเล็กน้อย
        gamma = 0.75
        alpha = 1.2
        beta = 10
        label = "NORMAL"
    else:
        # 🔆 ภาพสว่างเกินไป → ลดแสงลง เพิ่มคอนทราสต์
        gamma = 1.2
        alpha = 1.1
        beta = -20
        label = "BRIGHT"
    
    print(f"  [Auto-Brightness] mean={mean_brightness:.0f} → mode={label} (gamma={gamma}, alpha={alpha}, beta={beta})")

    # ใช้ Gamma Correction
    inv_gamma = 1.0 / gamma
    table = np.array([((i / 255.0) ** inv_gamma) * 255 for i in np.arange(0, 256)]).astype("uint8")
    image_gamma = cv2.LUT(image_rgb, table)

    # ใช้ Contrast + Brightness
    adjusted = cv2.convertScaleAbs(image_gamma, alpha=alpha, beta=beta)

    return adjusted


def enhance_image_color(image_rgb: np.ndarray) -> np.ndarray:
    """
    Enhance colors for children's cartoon drawings.
    Pipeline: AI Auto Brightness → ปรับความเข้มสี → CLAHE → Sharpen → ส่งให้ BGRM
    """
    # 1. AI Auto Brightness — ปรับแสงอัตโนมัติตามสภาพจริงของภาพ
    image_adjusted = _auto_adjust_brightness(image_rgb)

    # 2. บูสต์ Saturation 2.5 เท่า — ให้ทุกสีสดเด้งก่อนส่งลบพื้นหลัง
    hsv = cv2.cvtColor(image_adjusted, cv2.COLOR_RGB2HSV).astype(np.float32)
    hsv[:, :, 1] = np.clip(hsv[:, :, 1] * 3.5, 0, 255)
    hsv = hsv.astype(np.uint8)

    # 3. CLAHE — เกลี่ยแสงสว่าง ดึงรายละเอียดในที่มืด
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    hsv[:, :, 2] = clahe.apply(hsv[:, :, 2])

    result_rgb = cv2.cvtColor(hsv, cv2.COLOR_HSV2RGB)

    # 4. Unsharp Mask — เน้นขอบลวดลายและเส้นตัดให้คมชัด
    gaussian = cv2.GaussianBlur(result_rgb, (0, 0), 2.0)
    sharpened = cv2.addWeighted(result_rgb, 1.5, gaussian, -0.5, 0)

    return sharpened


def _fill_alpha_holes(alpha: np.ndarray) -> np.ndarray:
    """
    ถมรูโหว่ด้านในตัวสัตว์ ด้วย Morphological Closing + Flood Fill
    เพื่อไม่ให้สีที่ระบายจางๆ ถูก AI เจาะทะลุเป็นโปร่งใส
    """
    # 1. Morphological Closing — ปิดรอยแตก/รูเล็กๆ ก่อน
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (15, 15))
    closed = cv2.morphologyEx(alpha, cv2.MORPH_CLOSE, kernel, iterations=2)

    # 2. Flood Fill จากมุมทั้ง 4 เพื่อระบุ "พื้นที่ด้านนอก" จริงๆ
    h, w = closed.shape
    flood_mask = np.zeros((h + 2, w + 2), np.uint8)
    # Invert: ทำให้ด้านนอก (โปร่งใส) เป็นสีขาว
    inverted = cv2.bitwise_not(closed)
    # Flood fill จากมุมทั้ง 4 ของภาพ (ถือว่าเป็นพื้นที่ภายนอก)
    for seed in [(0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)]:
        cv2.floodFill(inverted, flood_mask, seed, 128)

    # 3. พิกเซลที่ไม่ใช่ 128 (ไม่ใช่ด้านนอก) = รูด้านใน → ถมให้ทึบ!
    holes = (inverted != 128).astype(np.uint8) * 255
    filled_alpha = cv2.bitwise_or(closed, holes)

    # 4. ลบ Noise เล็กๆ ด้านนอก (< 500px)
    contours, _ = cv2.findContours(filled_alpha, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    for cnt in contours:
        if cv2.contourArea(cnt) < 500:
            cv2.drawContours(filled_alpha, [cnt], -1, 0, -1)

    return filled_alpha

# โหลดโมเดลทีเดียว เพื่อประหยัดเวลาตอนทำงาน
_rembg_session = None

# Cache for templates
_templates = []
_templates_loaded = False

# ============================================================
# Template Matching System
# ============================================================

def _load_templates():
    """โหลด template ทั้งหมดและหา Feature (ORB) เตรียมไว้"""
    global _templates, _templates_loaded
    if _templates_loaded:
        return _templates
        
    template_dir = os.path.join(os.path.dirname(__file__), "templates")
    if not os.path.exists(template_dir):
        print(f"[Template] ไม่พบโฟลเดอร์ {template_dir}")
        return []
        
    processed_dir = os.path.join(template_dir, "processed")
    os.makedirs(processed_dir, exist_ok=True)
        
    sift = cv2.SIFT_create(nfeatures=5000)
    files = glob.glob(os.path.join(template_dir, "*.png")) + glob.glob(os.path.join(template_dir, "*.jpg"))
    # เอาเฉพาะรูปที่ไม่ใช่จากโฟลเดอร์ processed
    files = [f for f in files if "processed" not in f]
    
    for f in files:
        base_name = os.path.basename(f)
        mask_path = os.path.join(processed_dir, f"{os.path.splitext(base_name)[0]}_mask.png")
        
        img = cv2.imread(f, cv2.IMREAD_UNCHANGED)
        if img is None: continue
        
        # ถ้ารูปเล็กไปหรือใหญ่ไป ให้ resize (800px เพื่อความรวดเร็วและรูปทรงดั้งเดิมแบบเวอร์ชั่นที่แล้ว)
        h, w = img.shape[:2]
        nw = 800
        nh = int(h * (nw / w))
        img = cv2.resize(img, (nw, nh))
        
        # ถ้าย้อนกลับมา รันเซิร์ฟรอบหลัง ให้โหลด Mask ที่สกัดแล้วจากไดร์ฟมาใช้เลย (เร็วมาก)
        if os.path.exists(mask_path):
            mask = cv2.imread(mask_path, cv2.IMREAD_GRAYSCALE)
            print(f"[Template] โหลด Mask สำเร็จรูปจากไฟล์ {base_name}")
        else:
            print(f"[Template] กำลังสร้าง Mask ใหม่ให้ {base_name} (ขบวนการนี้ทำครั้งเดียว)...")
            # สร้าง Solid Blob Mask สมบูรณ์แบบจาก Template
            if len(img.shape) == 3 and img.shape[2] == 4:
                # ถ้ามี alpha ให้ดึง alpha ออกมา แล้วถมรูให้ทึบ 100%
                _, mask_alpha = cv2.threshold(img[:,:,3], 128, 255, cv2.THRESH_BINARY)
                mask = _fill_alpha_holes(mask_alpha)
            else:
                # ใช้ rembg สกัดภาพสัตว์จากพื้นหลังขาว 
                if len(img.shape) == 2:
                    img_rgb = cv2.cvtColor(img, cv2.COLOR_GRAY2RGB)
                else:
                    img_rgb = cv2.cvtColor(img, cv2.COLOR_BGR2RGB)
                
                # โหลด session ครั้งเดียว
                session = get_rembg_session()
                # ปิดใช้งาน alpha_matting ถาวร และเอา post_process ออกแบบเวอร์ชั่นเก่า (ได้รูปทรงเต็มตัว)
                out_rgba = remove(
                    img_rgb, 
                    session=session, 
                    alpha_matting=False
                )
                mask_alpha = out_rgba[:, :, 3]
                # ถมรูด้านในเผื่อ rembg ทะลุรอยสีขาว
                mask = _fill_alpha_holes(mask_alpha)
                
            # บันทึกเก็บไว้ใช้คราวหลัง จะได้ไม่ช้าอีก
            cv2.imwrite(mask_path, mask)
                
        # หา Keypoints ด้วย SIFT
        gray4sift = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY) if img.shape[2] != 1 else img
        kp, des = sift.detectAndCompute(gray4sift, None)
        
        if des is not None:
            _templates.append({
                "name": os.path.basename(f),
                "kp": kp,
                "des": des,
                "mask": mask,
                "shape": (nh, nw)
            })
            print(f"[Template] โหลด: {os.path.basename(f)} ({len(kp)} features)")
            
    _templates_loaded = True
    return _templates

def _match_template(warped_rgb):
    """หาว่าสแกนมาตรงกับ Template ไหน และคืนค่า Mask ที่ Wrap แล้ว"""
    templates = _load_templates()
    if not templates:
        return None
        
    # ทำขนาดให้เล็กลงเพื่อให้ทำงานเร็วขึ้น (เอาแค่โครงสร้างในการ Match)
    h_orig, w_orig = warped_rgb.shape[:2]
    match_width = 400
    match_height = int(h_orig * (match_width / w_orig))
    match_img = cv2.resize(warped_rgb, (match_width, match_height))
    
    gray = cv2.cvtColor(match_img, cv2.COLOR_RGB2GRAY)
    
    # ใช้วิธีหาขอบ (Edges) เพื่อลดการกวนจากสีและลวดลายการระบายสี
    edges_scan = cv2.Canny(gray, 50, 150)
    
    sift = cv2.SIFT_create()
    kp_scan, des_scan = sift.detectAndCompute(gray, None) # detect on gray for better features
    
    if des_scan is None or len(des_scan) < 10:
        return None
        
    # ใช้ FLANN ที่ทำงานได้เร็วกว่า BFMatcher มาก ๆ
    FLANN_INDEX_KDTREE = 1
    index_params = dict(algorithm = FLANN_INDEX_KDTREE, trees = 5)
    search_params = dict(checks=50)   # or pass empty dictionary
    flann = cv2.FlannBasedMatcher(index_params, search_params)
    
    best_match = None
    best_good_count = 0
    best_matches_data = None
    
    # 1. หาว่าตรงกับตัวไหนที่สุด
    for t in templates:
        # ใช้ Lowe's ratio test สำหรับ SIFT
        matches = flann.knnMatch(t["des"], des_scan, k=2)
        
        good = []
        for match_pair in matches:
            if len(match_pair) == 2:
                m, n = match_pair
                if m.distance < 0.75 * n.distance:
                    good.append(m)
        
        if len(good) > best_good_count:
            best_good_count = len(good)
            best_match = t
            best_matches_data = good
            
    print(f"[Template Match] เจอกับ {best_match['name'] if best_match else 'None'} (ตรง {best_good_count} จุด)")
    
    # ถ้าจุดตรงกันน้อยเกินไป น่าจะไม่ใช่รูปในชุด
    if best_good_count < 15 or not best_match:
        return None
        
    # 2. ทำ Homography เพื่อดึง Mask จาก Template มาทาบบน Scan
    src_pts = np.float32([best_match['kp'][m.queryIdx].pt for m in best_matches_data]).reshape(-1, 1, 2)
    dst_pts_small = np.float32([kp_scan[m.trainIdx].pt for m in best_matches_data]).reshape(-1, 1, 2)
    
    # Scale dst_pts กลับไปเป็นขนาดดั้งเดิมของภาพสแกน
    scale_x = w_orig / match_width
    scale_y = h_orig / match_height
    dst_pts = np.zeros_like(dst_pts_small)
    dst_pts[:, 0, 0] = dst_pts_small[:, 0, 0] * scale_x
    dst_pts[:, 0, 1] = dst_pts_small[:, 0, 1] * scale_y
    
    # เปลี่ยนจาก findHomography เป็น estimateAffinePartial2D เพื่อป้องกันภาพบิดเบี้ยวหลุดโลก (เป็นเส้นบางๆ)
    # Partial2D จะยอมให้แค่ หมุน (Rotation), เลื่อน (Translation), ย่อขยาย (Scale) เท่ากันทุกแกน
    M, mask_inliers = cv2.estimateAffinePartial2D(src_pts, dst_pts, method=cv2.RANSAC, ransacReprojThreshold=5.0)
    
    if M is not None:
        inliers_count = np.sum(mask_inliers)
        print(f"  [Template Match] Affine Inliers: {inliers_count}/{len(src_pts)}")
        
        # ถ้าน้อยกว่า 15 จุดตอนแปลงแกน แปลว่าภาพบิดเบี้ยวหรือจับคู่มั่ว
        if inliers_count > 15:
            # แปลง Mask ทึบของ Template ให้ทาบมาตรงกับภาพวาด (ใช้ warpAffine)
            aligned_mask = cv2.warpAffine(best_match['mask'], M, (w_orig, h_orig))
            return aligned_mask
        else:
            print("  [Template Match] Inliers น้อยเกินไป ข้าม Template")
    
    return None

def process_frame_to_transparent(frame: np.ndarray, doc_cnt: np.ndarray) -> np.ndarray:
    # 1. ดึงภาพเฉพาะในกรอบ 4 เหลี่ยม
    warped = four_point_transform(frame, doc_cnt.reshape(4, 2))

    # 2. ตัดขอบเข้าด้านใน 3% เพื่อลบขอบกระดาษ
    h, w = warped.shape[:2]
    margin_y = int(h * 0.03)
    margin_x = int(w * 0.03)
    warped_cropped = warped[margin_y:h - margin_y, margin_x:w - margin_x]

    # 3. แปลงสีและปรับแสง
    warped_rgb = cv2.cvtColor(warped_cropped, cv2.COLOR_BGR2RGB)
    enhanced_rgb = enhance_image_color(warped_rgb)

    # 4. ใช้ Template Matching เพื่อดึงเส้นขอบที่เป๊ะ 100%
    template_mask = _match_template(warped_rgb)
    
    if template_mask is not None:
        print("  [Template] ใช้ Mask จากภาพต้นฉบับสำเร็จ!")
        
        # ทำให้แน่ใจว่า mask เป็นขาวดำสนิท (0 หรือ 255)
        _, template_mask_bin = cv2.threshold(template_mask, 127, 255, cv2.THRESH_BINARY)
        
        # ใช้ฟังก์ชันถมดำด้านในที่เสถียรที่สุดของเรา (_fill_alpha_holes) แบบไม่ต้องคิดใหม่
        # แต่ก่อนอื่น ตัว template_mask ที่ลากเส้นทับ อาจจะทำให้เส้นขาดนิดหน่อย ปิดรอยแตกก่อน 1 ที
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
        template_mask_closed = cv2.morphologyEx(template_mask_bin, cv2.MORPH_CLOSE, kernel)
        
        # ถมรูด้านในทั้งหมดให้ทึบ 100%
        final_solid = _fill_alpha_holes(template_mask_closed)

        # ใส่ Mask ลงไป (พื้นหลังเป็นใส 100% ตัวสัตว์สีมาเต็มร้อย)
        final_bgra = cv2.cvtColor(enhanced_rgb, cv2.COLOR_RGB2BGRA)
        final_bgra[:, :, 3] = final_solid
        return final_bgra

    # 5. Fallback: ถ้า Match ไม่สำเร็จ → ลอง rembg
    print("  [Template] Match ไม่สำเร็จ → ใช้ rembg แทน")
    output_rgba = remove(
        enhanced_rgb,
        session=get_rembg_session(),
        alpha_matting=False,
        post_process_mask=True
    )
    
    alpha = output_rgba[:, :, 3]
    total_pixels = alpha.shape[0] * alpha.shape[1]
    foreground_pixels = np.count_nonzero(alpha > 128)
    coverage = foreground_pixels / total_pixels
    print(f"  [RMBG] foreground coverage = {coverage:.1%}")
    
    if coverage > 0.30:
        filled_alpha = _fill_alpha_holes(alpha)
        final_bgra = cv2.cvtColor(enhanced_rgb, cv2.COLOR_RGB2BGRA)
        final_bgra[:, :, 3] = filled_alpha
        print("  [RMBG] → ใช้ cutout")
    else:
        final_bgra = cv2.cvtColor(enhanced_rgb, cv2.COLOR_RGB2BGRA)
        final_bgra[:, :, 3] = 255
        print("  [RMBG] → ใช้สี่เหลี่ยมเต็ม")

    return final_bgra


def get_rembg_session():
    global _rembg_session
    if _rembg_session is None:
        _rembg_session = new_session("birefnet-general")
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