#!/usr/bin/env python3
"""Build the web-optimised media in public/media from the masters in media-src.

The generated files are committed, so the site build (Vite) never needs Python
or ffmpeg. Re-run this only when a master changes:

    python3 scripts/build_media.py            # everything
    python3 scripts/build_media.py hero       # one group: hero | compare | projects | brand

Requirements: Python 3.10+, Pillow (with WebP), ffmpeg on PATH.
"""
from __future__ import annotations

import json
import shutil
import subprocess
import sys
from collections.abc import Iterator
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "media-src"
OUT = ROOT / "public" / "media"
DATA = ROOT / "src" / "data"

# Hero frame sets: (folder, output size, crop box in master pixels or None, WebP quality)
HERO_MASTER = SRC / "hero" / "hero-master-4k.mp4"
MASTER_W, MASTER_H = 3840, 2160
PORTRAIT_CROP_W = round(MASTER_H * 9 / 16)  # 1215 px wide 9:16 slice of the 4K master
PORTRAIT_X = (MASTER_W - PORTRAIT_CROP_W) // 2
HERO_SETS = [
    ("d", (1920, 1080), None, 62),
    ("m", (720, 1280), (PORTRAIT_X, 0, PORTRAIT_X + PORTRAIT_CROP_W, MASTER_H), 66),
]
POSTERS = [
    ("poster-d.webp", (1920, 1080), None, 80),
    ("poster-m.webp", (900, 1600), (PORTRAIT_X, 0, PORTRAIT_X + PORTRAIT_CROP_W, MASTER_H), 78),
]

PROJECT_WIDTHS = (640, 1080, 1600)
PROJECT_QUALITY = 78


def save_webp(img: Image.Image, path: Path, quality: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    img.save(path, "WEBP", quality=quality, method=6)


def fit(img: Image.Image, size: tuple[int, int], crop: tuple[int, int, int, int] | None) -> Image.Image:
    if crop:
        img = img.crop(crop)
    return img.resize(size, Image.LANCZOS)


def hero_frames() -> Iterator[Image.Image]:
    """Decode every frame of the 4K master as RGB (streamed through ffmpeg)."""
    cmd = ["ffmpeg", "-v", "error", "-i", str(HERO_MASTER), "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE)
    frame_bytes = MASTER_W * MASTER_H * 3
    while True:
        buf = proc.stdout.read(frame_bytes)
        if len(buf) < frame_bytes:
            break
        yield Image.frombytes("RGB", (MASTER_W, MASTER_H), buf)
    proc.wait()


def build_hero() -> None:
    out = OUT / "hero"
    for folder, *_ in HERO_SETS:
        shutil.rmtree(out / folder, ignore_errors=True)
    count = 0
    for i, frame in enumerate(hero_frames()):
        for folder, size, crop, quality in HERO_SETS:
            save_webp(fit(frame, size, crop), out / folder / f"{i:04d}.webp", quality)
        if i == 0:
            for name, size, crop, quality in POSTERS:
                save_webp(fit(frame, size, crop), out / name, quality)
            og = fit(frame, (1200, 675), None).crop((0, 22, 1200, 652))
            og.save(OUT / "og-image.jpg", quality=86, optimize=True, progressive=True)
        count = i + 1
    meta = {
        "frames": count,
        "fps": 24,
        "sets": {folder: {"width": size[0], "height": size[1]} for folder, size, _, _ in HERO_SETS},
    }
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "hero.json").write_text(json.dumps(meta, indent=1))
    print(f"hero: {count} frames per set")


def build_compare() -> None:
    before = Image.open(SRC / "compare" / "before-vahagni-site-photo.jpg").convert("RGB")
    after = Image.open(SRC / "compare" / "after-vahagni-visualization.png").convert("RGB")
    # The visualization was generated at 2048x1360; match it to the photo's exact frame.
    after = after.resize(before.size, Image.LANCZOS)
    for w in (800, 1200, 1600):
        h = round(before.height * w / before.width)
        save_webp(before.resize((w, h), Image.LANCZOS), OUT / "compare" / f"before-{w}.webp", 80)
        save_webp(after.resize((w, h), Image.LANCZOS), OUT / "compare" / f"after-{w}.webp", 80)
    print("compare: done", before.size)


def build_projects() -> None:
    sources = json.loads((SRC / "sources.json").read_text())
    shutil.rmtree(OUT / "work", ignore_errors=True)
    shutil.rmtree(OUT / "team", ignore_errors=True)
    index: dict[str, dict] = {}
    for group, items in sources.items():
        folder = "team" if group == "team" else f"work/{group}"
        widths = (480,) if group == "team" else PROJECT_WIDTHS
        for item in items:
            img = Image.open(ROOT / item["file"]).convert("RGB")
            variants = []
            # Every standard width below the source, plus the source width itself (capped at the largest).
            targets = sorted({w for w in widths if w < img.width} | {min(widths[-1], img.width)})
            for w in targets:
                h = round(img.height * w / img.width)
                name = f"{item['id']}-{w}.webp"
                save_webp(img.resize((w, h), Image.LANCZOS), OUT / folder / name, PROJECT_QUALITY)
                variants.append({"src": f"media/{folder}/{name}", "w": w, "h": h})
            index[str(item["id"])] = {"group": group, "variants": variants, "ratio": img.width / img.height}
    DATA.mkdir(parents=True, exist_ok=True)
    (DATA / "images.json").write_text(json.dumps(index, indent=1))
    print(f"projects: {len(index)} images")


def build_brand() -> None:
    fav = Image.open(SRC / "brand" / "tutto-favicon-original.png").convert("RGBA")
    for size, name in ((32, "favicon-32.png"), (180, "apple-touch-icon.png"), (512, "icon-512.png")):
        canvas = Image.new("RGBA", fav.size, (20, 19, 18, 255))
        canvas.alpha_composite(fav)
        canvas.convert("RGB").resize((size, size), Image.LANCZOS).save(ROOT / "public" / name, optimize=True)
    print("brand: icons done")


GROUPS = {"hero": build_hero, "compare": build_compare, "projects": build_projects, "brand": build_brand}

if __name__ == "__main__":
    wanted = sys.argv[1:] or list(GROUPS)
    for key in wanted:
        GROUPS[key]()
