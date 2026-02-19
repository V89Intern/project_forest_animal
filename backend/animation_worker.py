import os
import shlex
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
from typing import Dict


PROJECT_ROOT = Path(__file__).resolve().parents[1]
INPUT_DIR = PROJECT_ROOT / "outputs"
OUTPUT_DIR = PROJECT_ROOT / "static" / "animations"
POLL_INTERVAL_SECONDS = 5

SUPPORTED_TYPES = {"sky", "ground", "water"}
MOTION_BY_TYPE: Dict[str, str] = {
    "sky": "fly",
    "ground": "walk",
    "water": "swim",
}


def ensure_python_310() -> None:
    if sys.version_info[:2] < (3, 10):
        raise RuntimeError(f"Python >= 3.10 is required. Current version: {sys.version.split()[0]}")
    if sys.version_info[:2] != (3, 10):
        print(
            f"[WARN] Recommended Python is 3.10 for full compatibility. Current version: {sys.version.split()[0]}",
            file=sys.stderr,
        )


def parse_type_from_filename(filename: str) -> str:
    animal_type = filename.split("_", 1)[0].lower()
    if animal_type not in SUPPORTED_TYPES:
        raise ValueError(f"Unsupported type in filename: {filename}")
    return animal_type


def output_path_for(image_path: Path, suffix: str = ".gif") -> Path:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    stem = image_path.stem
    return OUTPUT_DIR / f"{stem}{suffix}"


def process_animation(image_path: str, animal_type: str) -> Path:
    image = Path(image_path)
    if not image.exists():
        raise FileNotFoundError(f"Input image not found: {image}")
    if animal_type not in SUPPORTED_TYPES:
        raise ValueError(f"Unsupported animal_type: {animal_type}")

    motion = MOTION_BY_TYPE[animal_type]
    output_ext = os.getenv("ANIMATION_OUTPUT_EXT", ".gif")
    output_file = output_path_for(image, output_ext)

    cmd_template = os.getenv(
        "ANIMATED_DRAWINGS_CMD",
        "python -m animated_drawings render --input_image {input} --motion {motion} --output {output}",
    )
    formatted = cmd_template.format(input=str(image), motion=motion, output=str(output_file))
    command = shlex.split(formatted, posix=False)

    result = subprocess.run(command, capture_output=True, text=True)
    if result.returncode != 0:
        stderr = (result.stderr or "").strip()
        stdout = (result.stdout or "").strip()
        error_text = stderr if stderr else stdout
        raise RuntimeError(f"Animated Drawings failed for {image.name}: {error_text}")

    return output_file


def loop_watch_outputs() -> None:
    INPUT_DIR.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    processed = set()
    print(f"[{datetime.now().isoformat()}] Worker started. Watching: {INPUT_DIR.resolve()}")

    while True:
        try:
            png_files = sorted(INPUT_DIR.glob("*.png"))
            for png in png_files:
                if png.name in processed:
                    continue
                try:
                    animal_type = parse_type_from_filename(png.name)
                    output = process_animation(str(png), animal_type)
                    processed.add(png.name)
                    print(f"[OK] {png.name} -> {output}")
                except Exception as exc:
                    print(f"[ERROR] {png.name}: {exc}")
            time.sleep(POLL_INTERVAL_SECONDS)
        except KeyboardInterrupt:
            print("Worker stopped by user.")
            break


if __name__ == "__main__":
    ensure_python_310()
    loop_watch_outputs()

