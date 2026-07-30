#!/usr/bin/env python3

import hashlib
import io
import os
import random
from pathlib import Path

import cbor2
from PIL import Image, ImageDraw, ImageFilter, ImageFont


MAP_NAME = "neonvault"
DISPLAY_NAME = "Neon Vault"
ASSET_PREFIX = "packages/bouncecore/neonvault"
MAP_PREFIX = f"packages/base/{MAP_NAME}"

CYAN = (0, 214, 255)
MAGENTA = (255, 36, 186)
LIME = (164, 255, 0)
INK = (5, 7, 18)
PANEL = (14, 18, 32)


def font(size):
    path = os.environ.get(
        "CORE_FPS_ARENA_FONT",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    )
    return ImageFont.truetype(path, size)


def png_bytes(image):
    output = io.BytesIO()
    image.save(output, format="PNG", optimize=True)
    return output.getvalue()


def jpg_bytes(image):
    output = io.BytesIO()
    image.convert("RGB").save(
        output,
        format="JPEG",
        quality=92,
        optimize=True,
        progressive=True,
        subsampling=0,
    )
    return output.getvalue()


def add_grain(image, seed, amount=16):
    rng = random.Random(seed)
    pixels = image.load()
    width, height = image.size
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            delta = rng.randint(-amount, amount)
            pixels[x, y] = (
                max(0, min(255, r + delta)),
                max(0, min(255, g + delta)),
                max(0, min(255, b + delta)),
                a,
            )


def neon_layer(size, lines):
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    for points, color, width in lines:
        draw.line(points, fill=color + (210,), width=width)
    return glow.filter(ImageFilter.GaussianBlur(10))


def make_floor():
    image = Image.new("RGBA", (512, 512), PANEL + (255,))
    draw = ImageDraw.Draw(image)
    for y in range(0, 512, 64):
        for x in range(0, 512, 64):
            shade = 22 if (x // 64 + y // 64) % 2 == 0 else 13
            draw.rectangle((x, y, x + 63, y + 63), fill=(shade, shade + 2, shade + 9, 255))

    lines = []
    for position in range(0, 513, 64):
        color = CYAN if (position // 64) % 2 == 0 else MAGENTA
        lines.append(((position, 0, position, 512), color, 3))
        lines.append(((0, position, 512, position), color, 3))
    image = Image.alpha_composite(image, neon_layer(image.size, lines))
    draw = ImageDraw.Draw(image)
    for points, color, width in lines:
        draw.line(points, fill=color + (230,), width=width)
    draw.ellipse((204, 204, 308, 308), outline=LIME + (255,), width=8)
    draw.ellipse((240, 240, 272, 272), fill=MAGENTA + (255,))
    add_grain(image, 101, 7)
    return image


def make_wall():
    image = Image.new("RGBA", (512, 512), (11, 13, 24, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, 512, 128):
        for x in range(0, 512, 128):
            draw.rounded_rectangle(
                (x + 7, y + 7, x + 121, y + 121),
                radius=5,
                fill=(21, 25, 40, 255),
                outline=(48, 55, 72, 255),
                width=3,
            )
            for px, py in (
                (x + 16, y + 16),
                (x + 112, y + 16),
                (x + 16, y + 112),
                (x + 112, y + 112),
            ):
                draw.ellipse((px - 3, py - 3, px + 3, py + 3), fill=(112, 118, 132, 255))
    draw.line((0, 256, 512, 256), fill=CYAN + (255,), width=4)
    draw.line((256, 0, 256, 512), fill=MAGENTA + (255,), width=4)
    add_grain(image, 202, 9)
    return image


def make_trim():
    image = Image.new("RGBA", (512, 512), (8, 10, 20, 255))
    draw = ImageDraw.Draw(image)
    for offset in range(-512, 1024, 96):
        draw.polygon(
            [(offset, 0), (offset + 48, 0), (offset - 464, 512), (offset - 512, 512)],
            fill=CYAN + (255,),
        )
        draw.polygon(
            [(offset + 48, 0), (offset + 72, 0), (offset - 440, 512), (offset - 464, 512)],
            fill=(245, 245, 255, 255),
        )
        draw.polygon(
            [(offset + 72, 0), (offset + 96, 0), (offset - 416, 512), (offset - 440, 512)],
            fill=MAGENTA + (255,),
        )
    add_grain(image, 303, 8)
    return image


def make_accent(color, label):
    image = Image.new("RGBA", (512, 512), PANEL + (255,))
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    for inset in (40, 92, 144):
        glow_draw.rounded_rectangle(
            (inset, inset, 512 - inset, 512 - inset),
            radius=26,
            outline=color + (230,),
            width=12,
        )
    image = Image.alpha_composite(image, glow.filter(ImageFilter.GaussianBlur(16)))
    draw = ImageDraw.Draw(image)
    for inset in (40, 92, 144):
        draw.rounded_rectangle(
            (inset, inset, 512 - inset, 512 - inset),
            radius=26,
            outline=color + (255,),
            width=6,
        )
    title_font = font(52)
    bounds = draw.textbbox((0, 0), label, font=title_font)
    draw.text(
        ((512 - (bounds[2] - bounds[0])) / 2, 224),
        label,
        fill=(255, 255, 255, 255),
        font=title_font,
        stroke_width=3,
        stroke_fill=INK + (255,),
    )
    return image


def make_brand():
    image = Image.new("RGBA", (512, 512), INK + (255,))
    lines = [
        ((24, 84, 488, 84), CYAN, 9),
        ((24, 428, 488, 428), MAGENTA, 9),
        ((78, 24, 78, 488), LIME, 5),
    ]
    image = Image.alpha_composite(image, neon_layer(image.size, lines))
    draw = ImageDraw.Draw(image)
    for points, color, width in lines:
        draw.line(points, fill=color + (255,), width=width)

    logo_font = font(54)
    sub_font = font(36)
    for text, y, active_font, color in (
        ("BOUNCECORE", 168, logo_font, (255, 255, 255)),
        ("NEON VAULT", 250, sub_font, LIME),
    ):
        bounds = draw.textbbox((0, 0), text, font=active_font, stroke_width=3)
        width = bounds[2] - bounds[0]
        draw.text(
            ((512 - width) / 2, y),
            text,
            font=active_font,
            fill=color + (255,),
            stroke_width=3,
            stroke_fill=INK + (255,),
        )
    return image


def make_preview():
    image = Image.new("RGBA", (1280, 720), (4, 5, 14, 255))
    draw = ImageDraw.Draw(image)
    draw.polygon(
        [(120, 610), (360, 186), (920, 186), (1160, 610)],
        fill=(17, 22, 38, 255),
        outline=(70, 80, 112, 255),
        width=6,
    )
    for row in range(7):
        y = 246 + row * 54
        ratio = (y - 186) / (610 - 186)
        left = int(360 - 240 * ratio)
        right = int(920 + 240 * ratio)
        draw.line((left, y, right, y), fill=(32, 55, 75, 255), width=2)
    for column in range(9):
        top_x = 360 + column * 70
        bottom_x = 120 + column * 130
        draw.line((top_x, 186, bottom_x, 610), fill=(46, 30, 72, 255), width=2)

    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    glow_draw.rounded_rectangle((138, 282, 370, 550), radius=18, outline=CYAN + (255,), width=18)
    glow_draw.rounded_rectangle((910, 282, 1142, 550), radius=18, outline=MAGENTA + (255,), width=18)
    glow_draw.rounded_rectangle((456, 288, 824, 554), radius=18, outline=LIME + (255,), width=12)
    glow_draw.line((364, 382, 916, 382), fill=CYAN + (255,), width=12)
    image = Image.alpha_composite(image, glow.filter(ImageFilter.GaussianBlur(22)))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle((138, 282, 370, 550), radius=18, outline=CYAN + (255,), width=8)
    draw.rounded_rectangle((910, 282, 1142, 550), radius=18, outline=MAGENTA + (255,), width=8)
    draw.rounded_rectangle((456, 288, 824, 554), radius=18, outline=LIME + (255,), width=6)
    draw.line((364, 382, 916, 382), fill=(255, 255, 255, 255), width=6)

    for x, color in ((252, CYAN), (1028, MAGENTA)):
        draw.ellipse(
            (x - 38, 386, x + 38, 462),
            fill=color + (255,),
            outline=(255, 255, 255, 255),
            width=5,
        )
    for x, y in (
        (514, 344),
        (640, 344),
        (766, 344),
        (514, 492),
        (640, 492),
        (766, 492),
    ):
        draw.rectangle(
            (x - 16, y - 16, x + 16, y + 16),
            fill=(25, 28, 44, 255),
            outline=LIME + (255,),
            width=4,
        )

    draw.rectangle((0, 0, 1280, 122), fill=(3, 4, 12, 236))
    title_font = font(70)
    sub_font = font(26)
    draw.text((54, 20), "NEON VAULT", font=title_font, fill=(255, 255, 255, 255))
    draw.text((828, 42), "FFA  /  TDM  /  CTF", font=sub_font, fill=LIME + (255,))
    draw.text((54, 658), "A BOUNCECORE ORIGINAL ARENA", font=sub_font, fill=CYAN + (255,))
    return image


def make_cfg():
    relative_prefix = ASSET_PREFIX.removeprefix("packages/")
    return f"""// Bouncecore Neon Vault - generated competitive arena
texturereset

setshader "stdworld"
texture 0 "{relative_prefix}/floor.png"
texture 0 "{relative_prefix}/wall.png"
texture 0 "{relative_prefix}/trim.png"
texture 0 "{relative_prefix}/cyan.png"
texture 0 "{relative_prefix}/magenta.png"
texture 0 "{relative_prefix}/lime.png"
texture 0 "{relative_prefix}/brand.png"

maptitle "{DISPLAY_NAME}"
ambient 24
skylight 0 0 0
fog 1400
fogcolour 5 7 18
lightprecision 24
lighterror 4
"""


def store_asset(asset_root, index, data, path):
    digest = hashlib.sha256(data).hexdigest()
    (asset_root / digest).write_bytes(data)
    if digest not in index["assets"]:
        index["assets"].append(digest)
    return [digest, path]


def main():
    asset_root = Path(os.environ.get("CORE_FPS_ASSET_ROOT", "/opt/core/assets"))
    map_path = Path(os.environ.get("CORE_FPS_NEON_VAULT_OGZ", "/tmp/neonvault.ogz"))
    index_path = asset_root / ".index.source"

    if not map_path.exists():
        raise RuntimeError(f"Generated arena is missing: {map_path}")

    index = cbor2.loads(index_path.read_bytes())
    payloads = [
        (map_path.read_bytes(), f"{MAP_PREFIX}.ogz"),
        (make_cfg().encode("utf-8"), f"{MAP_PREFIX}.cfg"),
        (png_bytes(make_floor()), f"{ASSET_PREFIX}/floor.png"),
        (png_bytes(make_wall()), f"{ASSET_PREFIX}/wall.png"),
        (png_bytes(make_trim()), f"{ASSET_PREFIX}/trim.png"),
        (png_bytes(make_accent(CYAN, "CYAN CLUB")), f"{ASSET_PREFIX}/cyan.png"),
        (png_bytes(make_accent(MAGENTA, "PINK CLUB")), f"{ASSET_PREFIX}/magenta.png"),
        (png_bytes(make_accent(LIME, "DANCEFLOOR")), f"{ASSET_PREFIX}/lime.png"),
        (png_bytes(make_brand()), f"{ASSET_PREFIX}/brand.png"),
        (jpg_bytes(make_preview()), f"{MAP_PREFIX}.jpg"),
    ]

    assets = [store_asset(asset_root, index, data, path) for data, path in payloads]
    asset_lookup = {path: digest for digest, path in assets}
    ogz_hash = asset_lookup[f"{MAP_PREFIX}.ogz"]
    preview_hash = asset_lookup[f"{MAP_PREFIX}.jpg"]
    bundle_hash = hashlib.sha256(
        "\n".join(f"{digest}:{path}" for digest, path in assets).encode("utf-8")
    ).hexdigest()

    index["bundles"] = [
        bundle for bundle in index["bundles"] if bundle.get("id") != bundle_hash
    ]
    index["bundles"].append(
        {
            "id": bundle_hash,
            # False means the runtime assembles and transfers this small map
            # bundle from its content-addressed assets on demand.
            "desktop": False,
            "web": False,
            "assets": assets,
        }
    )

    index["maps"] = [
        game_map for game_map in index["maps"] if game_map.get("name") != MAP_NAME
    ]
    index["maps"].append(
        {
            "id": ogz_hash,
            "name": MAP_NAME,
            "ogz": ogz_hash,
            "bundle": bundle_hash,
            "assets": assets,
            "image": f"{preview_hash}.jpg",
            "description": (
                "Neon Vault is a symmetrical Bouncecore rave arena built for "
                "Free For All, Team Deathmatch and Capture the Flag."
            ),
        }
    )

    index_path.write_bytes(cbor2.dumps(index))
    (asset_root / ".bouncecore-neon-vault").write_text(
        f"{DISPLAY_NAME} {ogz_hash}\n",
        encoding="ascii",
    )


if __name__ == "__main__":
    main()
