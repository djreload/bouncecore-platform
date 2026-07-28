#!/usr/bin/env python3

import hashlib
import io
import os
from pathlib import Path

import cbor2
from PIL import Image, ImageDraw, ImageFont


ASSET_PATHS = {
    "packages/models/flags/red/skin.jpg": "#ff2b55",
    "packages/models/flags/blue/skin.jpg": "#00d5ff",
}


def find_asset_hash(index, asset_path):
    for bundle in index.get("bundles", []):
        for asset_hash, path in bundle.get("assets", []):
            if path == asset_path:
                return asset_hash
    raise RuntimeError(f"Core asset index does not contain {asset_path}")


def replace_hash(value, old_hash, new_hash):
    if isinstance(value, str):
        return new_hash if value == old_hash else value
    if isinstance(value, list):
        return [replace_hash(item, old_hash, new_hash) for item in value]
    if isinstance(value, dict):
        return {
            key: replace_hash(item, old_hash, new_hash)
            for key, item in value.items()
        }
    return value


def fitted_font(draw, text, max_width, start_size):
    font_path = os.environ.get(
        "CORE_FPS_FLAG_FONT",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    )
    for size in range(start_size, 9, -1):
        font = ImageFont.truetype(font_path, size)
        bounds = draw.textbbox((0, 0), text, font=font, stroke_width=1)
        if bounds[2] - bounds[0] <= max_width:
            return font
    return ImageFont.load_default()


def branded_skin(source, accent):
    skin = Image.open(io.BytesIO(source)).convert("RGBA")
    if skin.size != (512, 512):
        raise RuntimeError(f"Unexpected Core flag skin dimensions: {skin.size}")

    overlay = Image.new("RGBA", skin.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)
    centre_x, centre_y = 140, 176

    draw.ellipse(
        (centre_x - 67, centre_y - 67, centre_x + 67, centre_y + 67),
        fill=(5, 7, 18, 205),
        outline=accent,
        width=5,
    )
    draw.arc(
        (centre_x - 42, centre_y - 42, centre_x + 42, centre_y + 42),
        110,
        250,
        fill="#00d5ff",
        width=9,
    )
    draw.arc(
        (centre_x - 42, centre_y - 42, centre_x + 42, centre_y + 42),
        290,
        70,
        fill="#00d5ff",
        width=9,
    )
    draw.ellipse(
        (centre_x - 12, centre_y - 12, centre_x + 12, centre_y + 12),
        fill="#ff2bd6",
    )
    draw.line(
        (centre_x, centre_y - 50, centre_x, centre_y - 30),
        fill="#a6ff00",
        width=8,
    )
    draw.line(
        (centre_x, centre_y + 30, centre_x, centre_y + 50),
        fill="#a6ff00",
        width=8,
    )

    label = "BOUNCECORE"
    font = fitted_font(draw, label, 190, 24)
    bounds = draw.textbbox((0, 0), label, font=font, stroke_width=2)
    label_width = bounds[2] - bounds[0]
    draw.text(
        (centre_x - label_width / 2, 247),
        label,
        fill="#ffffff",
        font=font,
        stroke_fill="#050712",
        stroke_width=2,
    )

    branded = Image.alpha_composite(skin, overlay).convert("RGB")
    output = io.BytesIO()
    branded.save(output, format="JPEG", quality=95, optimize=True, subsampling=0)
    return output.getvalue()


def main():
    asset_root = Path(os.environ.get("CORE_FPS_ASSET_ROOT", "/opt/core/assets"))
    marker = asset_root / ".bouncecore-branded-flags"
    if marker.exists():
        return

    index_path = asset_root / ".index.source"
    index = cbor2.loads(index_path.read_bytes())

    for asset_path, accent in ASSET_PATHS.items():
        old_hash = find_asset_hash(index, asset_path)
        source_path = asset_root / old_hash
        branded = branded_skin(source_path.read_bytes(), accent)
        new_hash = hashlib.sha256(branded).hexdigest()
        (asset_root / new_hash).write_bytes(branded)
        index = replace_hash(index, old_hash, new_hash)

    index_path.write_bytes(cbor2.dumps(index))
    marker.write_text("Bouncecore red and blue CTF flag skins v1\n", encoding="ascii")


if __name__ == "__main__":
    main()
