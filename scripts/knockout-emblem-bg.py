#!/usr/bin/env python3
"""
Knock out near-white backgrounds on classic NBA emblems (flood-fill from edges).
Converts GIF → PNG with alpha. Leaves intentional interior white alone.

Usage: python3 scripts/knockout-emblem-bg.py [--thresh 245] [--force]
"""
from __future__ import annotations

import argparse
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
EMBLEMS = ROOT / "public" / "assets" / "emblems"


def is_bg(px, x: int, y: int, thresh: int) -> bool:
    r, g, b, a = px[x, y]
    if a < 8:
        return False
    return r >= thresh and g >= thresh and b >= thresh


def knock_out(im: Image.Image, thresh: int) -> tuple[Image.Image, int]:
    rgba = im.convert("RGBA")
    w, h = rgba.size
    px = rgba.load()
    seen = [[False] * w for _ in range(h)]
    q: deque[tuple[int, int]] = deque()

    def try_push(x: int, y: int) -> None:
        if 0 <= x < w and 0 <= y < h and not seen[y][x] and is_bg(px, x, y, thresh):
            q.append((x, y))

    for x in range(w):
        try_push(x, 0)
        try_push(x, h - 1)
    for y in range(h):
        try_push(0, y)
        try_push(w - 1, y)

    cleared = 0
    while q:
        x, y = q.popleft()
        if seen[y][x]:
            continue
        if not is_bg(px, x, y, thresh):
            continue
        seen[y][x] = True
        r, g, b, _ = px[x, y]
        px[x, y] = (r, g, b, 0)
        cleared += 1
        try_push(x - 1, y)
        try_push(x + 1, y)
        try_push(x, y - 1)
        try_push(x, y + 1)
    return rgba, cleared


def needs_work(path: Path, thresh: int) -> bool:
    im = Image.open(path).convert("RGBA")
    w, h = im.size
    px = im.load()
    # Opaque near-white on any corner → boxed background.
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        r, g, b, a = px[x, y]
        if a >= 200 and r >= thresh and g >= thresh and b >= thresh:
            return True
    if path.suffix.lower() == ".gif":
        # GIFs are usually opaque plates — always convert.
        return True
    return False


def process(path: Path, thresh: int, force: bool) -> str | None:
    if not force and not needs_work(path, thresh):
        return None
    im = Image.open(path)
    out, cleared = knock_out(im, thresh)
    if cleared == 0 and path.suffix.lower() != ".gif":
        return None
    dest = path if path.suffix.lower() == ".png" else path.with_suffix(".png")
    out.save(dest, "PNG")
    if dest != path and path.exists():
        path.unlink()
    return f"{path.name} → {dest.name} (cleared {cleared} px)"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--thresh", type=int, default=245)
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()
    files = sorted(
        [
            *EMBLEMS.glob("classic_*.png"),
            *EMBLEMS.glob("classic_*.gif"),
            *EMBLEMS.glob("classic_*.webp"),
            *EMBLEMS.glob("classic_*.jpg"),
            *EMBLEMS.glob("classic_*.jpeg"),
        ]
    )
    n = 0
    for path in files:
        try:
            msg = process(path, args.thresh, args.force)
        except Exception as exc:  # noqa: BLE001
            print(f"fail {path.name}: {exc}", file=sys.stderr)
            continue
        if msg:
            print(msg)
            n += 1
    # Patch teams.json badgeAsset extensions if gif→png.
    teams_path = ROOT / "public" / "data" / "teams.json"
    text = teams_path.read_text()
    changed = text
    for gif in EMBLEMS.glob("classic_*.gif"):
        pass  # already unlinked when converted
    # Any badgeAsset still pointing at a missing gif should prefer png.
    import json

    teams = json.loads(teams_path.read_text())
    patched = 0
    for team in teams:
        asset = team.get("badgeAsset")
        if not isinstance(asset, str) or not asset.startswith("/assets/emblems/classic_"):
            continue
        name = Path(asset).name
        full = EMBLEMS / name
        if full.exists():
            continue
        png = EMBLEMS / (Path(name).stem + ".png")
        if png.exists():
            team["badgeAsset"] = f"/assets/emblems/{png.name}"
            patched += 1
    if patched:
        teams_path.write_text(json.dumps(teams, indent=2) + "\n")
        print(f"teams.json badgeAsset retargeted: {patched}")
    print(f"knocked out {n}/{len(files)} emblems")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
