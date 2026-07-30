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
    image = Image.new("RGBA", (512, 512), (8, 10, 18, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, 512, 64):
        for x in range(0, 512, 64):
            shade = 25 if (x // 64 + y // 64) % 2 == 0 else 15
            draw.rectangle(
                (x + 2, y + 2, x + 62, y + 62),
                fill=(shade, shade + 2, shade + 10, 255),
                outline=(48, 52, 67, 255),
                width=2,
            )
            draw.line(
                (x + 8, y + 8, x + 54, y + 8),
                fill=(76, 82, 102, 90),
                width=2,
            )

    lines = []
    for position in range(0, 513, 128):
        color = CYAN if (position // 128) % 2 == 0 else MAGENTA
        lines.append(((position, 0, position, 512), color, 4))
        lines.append(((0, position, 512, position), color, 4))
    image = Image.alpha_composite(image, neon_layer(image.size, lines))
    draw = ImageDraw.Draw(image)
    for points, color, width in lines:
        draw.line(points, fill=color + (230,), width=width)
    add_grain(image, 101, 5)
    return image


def make_wall():
    image = Image.new("RGBA", (512, 512), (8, 10, 17, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, 512, 128):
        for x in range(0, 512, 128):
            draw.rounded_rectangle(
                (x + 6, y + 6, x + 122, y + 122),
                radius=8,
                fill=(18, 21, 31, 255),
                outline=(52, 58, 72, 255),
                width=3,
            )
            draw.rounded_rectangle(
                (x + 17, y + 17, x + 111, y + 111),
                radius=5,
                outline=(30, 35, 49, 255),
                width=3,
            )
            for px, py in (
                (x + 16, y + 16),
                (x + 112, y + 16),
                (x + 16, y + 112),
                (x + 112, y + 112),
            ):
                draw.ellipse((px - 3, py - 3, px + 3, py + 3), fill=(112, 118, 132, 255))
    add_grain(image, 202, 7)
    return image


def make_trim():
    image = Image.new("RGBA", (512, 512), (7, 9, 15, 255))
    draw = ImageDraw.Draw(image)
    for position in range(0, 513, 64):
        draw.line((position, 0, position, 512), fill=(53, 59, 71, 255), width=10)
        draw.line((0, position, 512, position), fill=(53, 59, 71, 255), width=10)
        draw.line((position + 5, 0, position + 5, 512), fill=(8, 9, 14, 255), width=2)
        draw.line((0, position + 5, 512, position + 5), fill=(8, 9, 14, 255), width=2)
    for offset in range(-512, 1024, 128):
        draw.line((offset, 0, offset - 512, 512), fill=CYAN + (180,), width=5)
        draw.line((offset + 64, 0, offset - 448, 512), fill=MAGENTA + (180,), width=5)
    add_grain(image, 303, 5)
    return image


def make_accent(color, label):
    image = Image.new("RGBA", (512, 512), (9, 12, 22, 255))
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    for inset in (28, 84, 140):
        glow_draw.rounded_rectangle(
            (inset, inset, 512 - inset, 512 - inset),
            radius=18,
            outline=color + (230,),
            width=9,
        )
    image = Image.alpha_composite(image, glow.filter(ImageFilter.GaussianBlur(14)))
    draw = ImageDraw.Draw(image)
    for inset in (28, 84, 140):
        draw.rounded_rectangle(
            (inset, inset, 512 - inset, 512 - inset),
            radius=18,
            outline=color + (255,),
            width=5,
        )
    draw.rectangle((80, 202, 432, 310), fill=(4, 6, 14, 225), outline=color + (255,), width=4)
    title_font = font(38)
    bounds = draw.textbbox((0, 0), label, font=title_font)
    draw.text(
        ((512 - (bounds[2] - bounds[0])) / 2, 232),
        label,
        fill=(255, 255, 255, 255),
        font=title_font,
        stroke_width=2,
        stroke_fill=INK + (255,),
    )
    add_grain(image, sum(color), 4)
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


def make_door():
    image = Image.new("RGBA", (512, 512), (7, 9, 15, 255))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (34, 18, 478, 494),
        radius=12,
        fill=(18, 21, 30, 255),
        outline=(92, 98, 112, 255),
        width=8,
    )
    draw.line((256, 22, 256, 490), fill=(2, 3, 7, 255), width=8)
    for left, right, color in ((48, 246, CYAN), (266, 464, MAGENTA)):
        draw.rounded_rectangle(
            (left, 72, right, 448),
            radius=8,
            fill=(10, 13, 21, 255),
            outline=color + (220,),
            width=4,
        )
        for y in range(112, 424, 52):
            draw.line((left + 18, y, right - 18, y), fill=(42, 48, 61, 255), width=3)
        draw.rounded_rectangle(
            (left + 30, 270, right - 30, 294),
            radius=7,
            fill=(144, 151, 164, 255),
            outline=(235, 239, 246, 255),
            width=3,
        )
    draw.rounded_rectangle(
        (178, 28, 334, 68),
        radius=8,
        fill=(3, 11, 7, 255),
        outline=LIME + (255,),
        width=3,
    )
    exit_font = font(25)
    bounds = draw.textbbox((0, 0), "EXIT", font=exit_font)
    draw.text(
        ((512 - (bounds[2] - bounds[0])) / 2, 34),
        "EXIT",
        font=exit_font,
        fill=LIME + (255,),
    )
    add_grain(image, 707, 5)
    return image


def make_speaker():
    image = Image.new("RGBA", (512, 512), (5, 7, 12, 255))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (24, 16, 488, 496),
        radius=18,
        fill=(12, 15, 22, 255),
        outline=(72, 79, 92, 255),
        width=8,
    )
    for center_y, radius in ((154, 104), (368, 108)):
        glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.ellipse(
            (
                256 - radius,
                center_y - radius,
                256 + radius,
                center_y + radius,
            ),
            outline=(CYAN if center_y < 200 else MAGENTA) + (210,),
            width=16,
        )
        image = Image.alpha_composite(image, glow.filter(ImageFilter.GaussianBlur(12)))
        draw = ImageDraw.Draw(image)
        draw.ellipse(
            (
                256 - radius,
                center_y - radius,
                256 + radius,
                center_y + radius,
            ),
            fill=(8, 9, 13, 255),
            outline=(78, 85, 96, 255),
            width=8,
        )
        draw.ellipse(
            (
                256 - radius + 26,
                center_y - radius + 26,
                256 + radius - 26,
                center_y + radius - 26,
            ),
            fill=(25, 28, 38, 255),
            outline=(3, 4, 7, 255),
            width=8,
        )
        draw.ellipse(
            (226, center_y - 30, 286, center_y + 30),
            fill=(4, 5, 8, 255),
            outline=(118, 126, 141, 255),
            width=4,
        )
    for x, y in ((42, 34), (470, 34), (42, 478), (470, 478)):
        draw.ellipse((x - 5, y - 5, x + 5, y + 5), fill=(181, 187, 198, 255))
    return image


def make_booth():
    image = Image.new("RGBA", (512, 512), (7, 9, 17, 255))
    draw = ImageDraw.Draw(image)
    draw.rounded_rectangle(
        (18, 22, 494, 490),
        radius=18,
        fill=(13, 17, 28, 255),
        outline=(79, 86, 103, 255),
        width=7,
    )
    draw.rounded_rectangle(
        (48, 60, 464, 222),
        radius=12,
        fill=(3, 5, 12, 255),
        outline=CYAN + (255,),
        width=4,
    )
    levels = [52, 106, 76, 132, 188, 150, 96, 166, 118, 202, 172, 82]
    for index, level in enumerate(levels):
        x = 68 + index * 32
        color = CYAN if index < 4 else LIME if index < 8 else MAGENTA
        draw.rounded_rectangle(
            (x, 204 - level // 2, x + 18, 204),
            radius=4,
            fill=color + (235,),
        )
    for row in range(2):
        for column in range(8):
            x = 76 + column * 48
            y = 286 + row * 76
            color = CYAN if column % 3 == 0 else MAGENTA if column % 3 == 1 else LIME
            draw.ellipse((x - 13, y - 13, x + 13, y + 13), fill=(5, 6, 11, 255), outline=color + (255,), width=4)
            draw.line((x, y, x + 7, y - 8), fill=(255, 255, 255, 255), width=3)
    for x in range(76, 452, 54):
        draw.rounded_rectangle((x, 410, x + 22, 470), radius=5, fill=(38, 43, 55, 255))
        draw.line((x + 11, 420, x + 11, 458), fill=(218, 222, 231, 255), width=3)
    return image


def make_arch():
    image = Image.new("RGBA", (512, 512), (8, 9, 15, 255))
    draw = ImageDraw.Draw(image)
    for row, y in enumerate(range(0, 512, 64)):
        offset = -48 if row % 2 else 0
        for x in range(offset, 512, 96):
            draw.rounded_rectangle(
                (x + 3, y + 3, x + 91, y + 59),
                radius=7,
                fill=(24, 26, 35, 255),
                outline=(54, 58, 69, 255),
                width=3,
            )
            draw.line((x + 14, y + 13, x + 80, y + 13), fill=(78, 82, 94, 170), width=2)
    lines = [
        ((14, 0, 14, 512), CYAN, 7),
        ((498, 0, 498, 512), MAGENTA, 7),
    ]
    image = Image.alpha_composite(image, neon_layer(image.size, lines))
    draw = ImageDraw.Draw(image)
    for points, color, width in lines:
        draw.line(points, fill=color + (245,), width=width)
    add_grain(image, 808, 5)
    return image


def make_ceiling():
    image = Image.new("RGBA", (512, 512), (4, 6, 12, 255))
    draw = ImageDraw.Draw(image)
    for position in range(0, 513, 128):
        draw.line((position, 0, position, 512), fill=(58, 63, 76, 255), width=18)
        draw.line((0, position, 512, position), fill=(58, 63, 76, 255), width=18)
        draw.line((position, 0, position, 512), fill=(12, 14, 22, 255), width=8)
        draw.line((0, position, 512, position), fill=(12, 14, 22, 255), width=8)
    for x, y, color in (
        (64, 64, CYAN),
        (192, 192, MAGENTA),
        (320, 320, LIME),
        (448, 448, CYAN),
    ):
        glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
        glow_draw = ImageDraw.Draw(glow)
        glow_draw.ellipse((x - 30, y - 30, x + 30, y + 30), fill=color + (220,))
        image = Image.alpha_composite(image, glow.filter(ImageFilter.GaussianBlur(18)))
        draw = ImageDraw.Draw(image)
        draw.ellipse((x - 13, y - 13, x + 13, y + 13), fill=(244, 247, 255, 255), outline=color + (255,), width=5)
    return image


def make_stage():
    image = Image.new("RGBA", (512, 512), (9, 11, 18, 255))
    draw = ImageDraw.Draw(image)
    for y in range(-64, 576, 64):
        for x in range(-64, 576, 64):
            draw.polygon(
                [(x + 32, y), (x + 64, y + 32), (x + 32, y + 64), (x, y + 32)],
                fill=(18, 21, 31, 255),
                outline=(62, 68, 82, 255),
            )
    draw.line((0, 8, 512, 8), fill=CYAN + (255,), width=9)
    draw.line((0, 504, 512, 504), fill=MAGENTA + (255,), width=9)
    add_grain(image, 909, 5)
    return image


def make_preview():
    image = Image.new("RGBA", (1280, 720), (3, 4, 11, 255))
    draw = ImageDraw.Draw(image)

    # Acoustic club walls and recessed side rooms.
    draw.polygon(
        [(58, 130), (350, 188), (350, 600), (58, 678)],
        fill=(12, 16, 28, 255),
        outline=CYAN + (190,),
        width=5,
    )
    draw.polygon(
        [(1222, 130), (930, 188), (930, 600), (1222, 678)],
        fill=(12, 16, 28, 255),
        outline=MAGENTA + (190,),
        width=5,
    )

    # Perspective dance floor.
    floor_polygon = [(170, 676), (410, 310), (870, 310), (1110, 676)]
    draw.polygon(
        floor_polygon,
        fill=(12, 16, 28, 255),
        outline=(78, 86, 112, 255),
        width=6,
    )
    for row in range(8):
        y = 340 + row * 45
        ratio = (y - 310) / (676 - 310)
        left = int(410 - 240 * ratio)
        right = int(870 + 240 * ratio)
        color = CYAN if row % 2 == 0 else MAGENTA
        draw.line((left, y, right, y), fill=color + (135,), width=3)
    for column in range(11):
        top_x = 410 + column * 46
        bottom_x = 170 + column * 94
        color = CYAN if column % 2 == 0 else MAGENTA
        draw.line((top_x, 310, bottom_x, 676), fill=color + (120,), width=3)

    # Raised stage, branded back wall and DJ console.
    draw.polygon(
        [(354, 194), (926, 194), (860, 338), (420, 338)],
        fill=(23, 27, 40, 255),
        outline=LIME + (220,),
        width=5,
    )
    draw.rounded_rectangle(
        (430, 104, 850, 246),
        radius=22,
        fill=(5, 7, 17, 255),
        outline=LIME + (255,),
        width=7,
    )
    brand_font = font(50)
    brand_bounds = draw.textbbox((0, 0), "BOUNCECORE", font=brand_font)
    draw.text(
        ((1280 - (brand_bounds[2] - brand_bounds[0])) / 2, 124),
        "BOUNCECORE",
        font=brand_font,
        fill=(255, 255, 255, 255),
        stroke_width=3,
        stroke_fill=INK + (255,),
    )
    draw.rounded_rectangle(
        (494, 244, 786, 326),
        radius=10,
        fill=(9, 13, 24, 255),
        outline=CYAN + (255,),
        width=5,
    )
    for index, height in enumerate((22, 42, 31, 58, 48, 26, 54, 36, 64, 44)):
        x = 520 + index * 24
        color = CYAN if index < 4 else LIME if index < 7 else MAGENTA
        draw.rectangle((x, 306 - height, x + 13, 306), fill=color + (255,))

    # Speaker towers around the stage and dance floor.
    for x, top_y, scale, color in (
        (340, 206, 1.0, CYAN),
        (850, 206, 1.0, MAGENTA),
        (270, 412, 0.82, CYAN),
        (934, 412, 0.82, MAGENTA),
    ):
        width = int(90 * scale)
        height = int(220 * scale)
        draw.rounded_rectangle(
            (x, top_y, x + width, top_y + height),
            radius=12,
            fill=(6, 8, 14, 255),
            outline=color + (245,),
            width=5,
        )
        for center_y in (top_y + int(height * 0.3), top_y + int(height * 0.72)):
            radius = int(32 * scale)
            draw.ellipse(
                (x + width // 2 - radius, center_y - radius, x + width // 2 + radius, center_y + radius),
                fill=(17, 20, 29, 255),
                outline=(116, 124, 142, 255),
                width=4,
            )
            draw.ellipse(
                (x + width // 2 - 10, center_y - 10, x + width // 2 + 10, center_y + 10),
                fill=(2, 3, 7, 255),
            )

    # Side lounge archways and central balcony.
    for left, right, color in ((74, 286, CYAN), (994, 1206, MAGENTA)):
        draw.arc((left, 238, right, 510), 180, 360, fill=color + (255,), width=13)
        draw.line((left, 374, left, 566), fill=color + (255,), width=13)
        draw.line((right, 374, right, 566), fill=color + (255,), width=13)
        draw.rectangle((left + 28, 422, right - 28, 566), outline=(66, 72, 88, 255), width=5)
    draw.polygon(
        [(314, 380), (966, 380), (910, 430), (370, 430)],
        fill=(20, 24, 36, 255),
        outline=(235, 239, 246, 255),
        width=5,
    )
    draw.line((352, 392, 928, 392), fill=CYAN + (255,), width=5)
    draw.line((370, 418, 910, 418), fill=MAGENTA + (255,), width=5)

    # Venue lighting beams and ambient glow.
    glow = Image.new("RGBA", image.size, (0, 0, 0, 0))
    glow_draw = ImageDraw.Draw(glow)
    for start_x, color, end_x in (
        (300, CYAN, 530),
        (450, MAGENTA, 620),
        (830, CYAN, 750),
        (980, MAGENTA, 650),
    ):
        glow_draw.polygon(
            [(start_x - 10, 84), (start_x + 10, 84), (end_x + 80, 620), (end_x - 80, 620)],
            fill=color + (36,),
        )
    image = Image.alpha_composite(image, glow.filter(ImageFilter.GaussianBlur(18)))
    draw = ImageDraw.Draw(image)

    draw.rectangle((0, 0, 1280, 94), fill=(2, 3, 9, 238))
    title_font = font(54)
    sub_font = font(24)
    draw.text((42, 17), "NEON VAULT", font=title_font, fill=(255, 255, 255, 255))
    draw.text((945, 34), "FFA / TDM / CTF", font=sub_font, fill=LIME + (255,))
    draw.rectangle((0, 676, 1280, 720), fill=(2, 3, 9, 235))
    draw.text((42, 686), "BOUNCECORE NIGHTCLUB ARENA", font=sub_font, fill=CYAN + (255,))
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
texture 0 "{relative_prefix}/door.png"
texture 0 "{relative_prefix}/speaker.png"
texture 0 "{relative_prefix}/booth.png"
texture 0 "{relative_prefix}/arch.png"
texture 0 "{relative_prefix}/ceiling.png"
texture 0 "{relative_prefix}/stage.png"

maptitle "{DISPLAY_NAME}"
ambient 30
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
        (png_bytes(make_door()), f"{ASSET_PREFIX}/door.png"),
        (png_bytes(make_speaker()), f"{ASSET_PREFIX}/speaker.png"),
        (png_bytes(make_booth()), f"{ASSET_PREFIX}/booth.png"),
        (png_bytes(make_arch()), f"{ASSET_PREFIX}/arch.png"),
        (png_bytes(make_ceiling()), f"{ASSET_PREFIX}/ceiling.png"),
        (png_bytes(make_stage()), f"{ASSET_PREFIX}/stage.png"),
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
                "Neon Vault is a full Bouncecore nightclub arena with a DJ "
                "stage, dance floor, balcony, speaker stacks, club rooms and "
                "entrance arches, built for FFA, TDM and CTF."
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
