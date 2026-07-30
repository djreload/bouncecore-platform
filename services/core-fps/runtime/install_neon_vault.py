#!/usr/bin/env python3

import hashlib
import io
import os
import random
from pathlib import Path

import cbor2
from PIL import Image, ImageDraw, ImageFont


MAP_NAME = "neonvault"
DISPLAY_NAME = "Neon Vault"
ASSET_PREFIX = "packages/bouncecore/neonvault"
MAP_PREFIX = f"packages/base/{MAP_NAME}"

CYAN = (0, 214, 255)
MAGENTA = (255, 36, 186)
LIME = (164, 255, 0)
INK = (5, 7, 14)
GRASS = (55, 132, 52)
DIRT = (112, 73, 45)
STONE = (102, 108, 116)
WOOD = (137, 88, 46)
LEAVES = (43, 112, 52)


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


def clamp_channel(value):
    return max(0, min(255, value))


def pixel_variation(base, delta):
    return tuple(clamp_channel(channel + delta) for channel in base)


def add_pixel_noise(image, seed, base, square=16, amount=22):
    draw = ImageDraw.Draw(image)
    rng = random.Random(seed)
    for y in range(0, image.height, square):
        for x in range(0, image.width, square):
            delta = rng.randint(-amount, amount)
            draw.rectangle(
                (x, y, x + square - 1, y + square - 1),
                fill=pixel_variation(base, delta) + (255,),
            )


def make_grass():
    image = Image.new("RGBA", (512, 512), GRASS + (255,))
    add_pixel_noise(image, 101, GRASS, square=16, amount=24)
    draw = ImageDraw.Draw(image)
    rng = random.Random(102)
    for _ in range(190):
        x = rng.randrange(0, 32) * 16
        y = rng.randrange(0, 32) * 16
        color = (80, 160, 59) if rng.random() > 0.45 else (32, 96, 43)
        draw.rectangle((x, y, x + 7, y + 7), fill=color + (255,))
    return image


def make_dirt():
    image = Image.new("RGBA", (512, 512), DIRT + (255,))
    add_pixel_noise(image, 201, DIRT, square=16, amount=24)
    draw = ImageDraw.Draw(image)
    rng = random.Random(202)
    for _ in range(170):
        x = rng.randrange(0, 32) * 16
        y = rng.randrange(0, 32) * 16
        color = (79, 50, 34) if rng.random() > 0.5 else (145, 99, 57)
        draw.rectangle((x, y, x + 7, y + 7), fill=color + (255,))
    return image


def make_stone():
    image = Image.new("RGBA", (512, 512), (73, 78, 85, 255))
    draw = ImageDraw.Draw(image)
    rng = random.Random(301)
    for row, y in enumerate(range(0, 512, 64)):
        offset = -32 if row % 2 else 0
        for x in range(offset, 512, 96):
            shade = rng.randint(-16, 22)
            color = pixel_variation(STONE, shade)
            draw.rectangle(
                (x + 3, y + 3, x + 91, y + 59),
                fill=color + (255,),
                outline=(48, 52, 58, 255),
                width=5,
            )
            draw.line(
                (x + 12, y + 12, x + 80, y + 12),
                fill=pixel_variation(color, 25) + (255,),
                width=4,
            )
    return image


def make_wood():
    image = Image.new("RGBA", (512, 512), WOOD + (255,))
    draw = ImageDraw.Draw(image)
    rng = random.Random(401)
    for x in range(0, 512, 64):
        shade = rng.randint(-20, 18)
        color = pixel_variation(WOOD, shade)
        draw.rectangle((x, 0, x + 59, 512), fill=color + (255,))
        draw.rectangle((x + 59, 0, x + 63, 512), fill=(61, 38, 28, 255))
        for y in range(32, 512, 96):
            draw.rectangle(
                (x + 10, y, x + 42, y + 8),
                fill=pixel_variation(color, -28) + (255,),
            )
    return image


def make_leaves():
    image = Image.new("RGBA", (512, 512), LEAVES + (255,))
    add_pixel_noise(image, 501, LEAVES, square=16, amount=31)
    draw = ImageDraw.Draw(image)
    rng = random.Random(502)
    for _ in range(120):
        x = rng.randrange(0, 32) * 16
        y = rng.randrange(0, 32) * 16
        color = (78, 151, 62) if rng.random() > 0.5 else (25, 79, 41)
        draw.rectangle((x, y, x + 15, y + 7), fill=color + (255,))
    return image


def make_glass():
    image = Image.new("RGBA", (512, 512), (15, 35, 50, 255))
    draw = ImageDraw.Draw(image)
    for position in range(0, 513, 64):
        draw.line((position, 0, position, 512), fill=(71, 108, 131, 255), width=8)
        draw.line((0, position, 512, position), fill=(71, 108, 131, 255), width=8)
    for y in range(8, 512, 64):
        for x in range(8, 512, 64):
            draw.rectangle((x, y, x + 48, y + 48), fill=(18, 63, 82, 255))
            draw.rectangle((x + 7, y + 7, x + 15, y + 31), fill=(74, 165, 195, 255))
    return image


def make_path():
    image = Image.new("RGBA", (512, 512), (67, 69, 74, 255))
    draw = ImageDraw.Draw(image)
    rng = random.Random(601)
    for row, y in enumerate(range(0, 512, 64)):
        offset = -32 if row % 2 else 0
        for x in range(offset, 512, 64):
            shade = rng.randint(-18, 20)
            draw.rounded_rectangle(
                (x + 3, y + 3, x + 61, y + 61),
                radius=10,
                fill=pixel_variation((91, 94, 100), shade) + (255,),
                outline=(41, 43, 48, 255),
                width=5,
            )
    return image


def make_neon_block(color):
    image = Image.new("RGBA", (512, 512), pixel_variation(color, -110) + (255,))
    draw = ImageDraw.Draw(image)
    for y in range(0, 512, 64):
        for x in range(0, 512, 64):
            shade = 0 if (x // 64 + y // 64) % 2 == 0 else -35
            block_color = pixel_variation(color, shade)
            draw.rectangle(
                (x + 3, y + 3, x + 60, y + 60),
                fill=block_color + (255,),
                outline=pixel_variation(color, -130) + (255,),
                width=5,
            )
            draw.rectangle(
                (x + 11, y + 11, x + 47, y + 18),
                fill=pixel_variation(block_color, 45) + (255,),
            )
    return image


def make_speaker():
    image = Image.new("RGBA", (512, 512), (8, 10, 15, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((16, 16, 496, 496), fill=(13, 16, 22, 255), outline=(69, 73, 82, 255), width=12)
    for center_y, radius in ((154, 104), (370, 108)):
        draw.ellipse(
            (256 - radius, center_y - radius, 256 + radius, center_y + radius),
            fill=(25, 28, 35, 255),
            outline=(88, 93, 104, 255),
            width=12,
        )
        draw.ellipse(
            (256 - radius + 28, center_y - radius + 28, 256 + radius - 28, center_y + radius - 28),
            fill=(7, 9, 13, 255),
            outline=(43, 47, 56, 255),
            width=10,
        )
        draw.rectangle((238, center_y - 18, 274, center_y + 18), fill=(2, 3, 5, 255))
    for x, y, color in ((32, 32, CYAN), (464, 32, MAGENTA), (32, 464, LIME), (464, 464, CYAN)):
        draw.rectangle((x, y, x + 16, y + 16), fill=color + (255,))
    return image


def make_booth():
    image = Image.new("RGBA", (512, 512), (10, 12, 20, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((16, 16, 496, 496), fill=(18, 22, 31, 255), outline=(79, 84, 96, 255), width=10)
    levels = (42, 76, 54, 112, 88, 124, 64, 104, 78, 118, 50, 92)
    for index, level in enumerate(levels):
        x = 48 + index * 35
        color = CYAN if index < 4 else LIME if index < 8 else MAGENTA
        draw.rectangle((x, 210 - level, x + 20, 210), fill=color + (255,))
    for row in range(2):
        for column in range(8):
            x = 70 + column * 54
            y = 300 + row * 90
            color = (CYAN, MAGENTA, LIME)[column % 3]
            draw.rectangle((x - 14, y - 14, x + 14, y + 14), fill=(5, 7, 12, 255), outline=color + (255,), width=6)
    return image


def make_door():
    image = Image.new("RGBA", (512, 512), (54, 31, 22, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((22, 12, 490, 500), fill=(88, 50, 31, 255), outline=(35, 21, 17, 255), width=12)
    for y in range(32, 480, 96):
        draw.rectangle((44, y, 468, y + 72), fill=(113, 67, 38, 255), outline=(52, 31, 22, 255), width=8)
    draw.rectangle((398, 246, 438, 286), fill=(181, 153, 70, 255), outline=(63, 48, 22, 255), width=6)
    return image


def make_roof():
    image = Image.new("RGBA", (512, 512), (48, 18, 54, 255))
    draw = ImageDraw.Draw(image)
    for row, y in enumerate(range(0, 512, 48)):
        offset = -32 if row % 2 else 0
        for x in range(offset, 512, 64):
            color = (87, 31, 95) if row % 2 else (68, 25, 78)
            draw.rectangle((x + 2, y + 2, x + 62, y + 44), fill=color + (255,), outline=(31, 12, 39, 255), width=5)
            draw.rectangle((x + 10, y + 9, x + 50, y + 15), fill=(125, 45, 134, 255))
    return image


def make_sky():
    image = Image.new("RGBA", (512, 512), (15, 30, 62, 255))
    draw = ImageDraw.Draw(image)
    rng = random.Random(701)
    for _ in range(85):
        x = rng.randrange(0, 32) * 16
        y = rng.randrange(0, 32) * 16
        color = (185, 221, 255) if rng.random() > 0.25 else CYAN
        draw.rectangle((x, y, x + 5, y + 5), fill=color + (255,))
    for x, y in ((30, 90), (280, 250), (90, 390)):
        draw.rectangle((x, y, x + 180, y + 32), fill=(71, 91, 132, 255))
        draw.rectangle((x + 32, y - 16, x + 128, y + 48), fill=(88, 110, 151, 255))
    return image


def make_blackstone():
    image = Image.new("RGBA", (512, 512), (17, 19, 27, 255))
    draw = ImageDraw.Draw(image)
    for row, y in enumerate(range(0, 512, 64)):
        offset = -32 if row % 2 else 0
        for x in range(offset, 512, 96):
            draw.rectangle(
                (x + 3, y + 3, x + 91, y + 59),
                fill=(27, 30, 40, 255),
                outline=(8, 9, 14, 255),
                width=6,
            )
            draw.rectangle((x + 12, y + 11, x + 78, y + 17), fill=(46, 49, 61, 255))
    return image


PREVIEW_GLYPHS = {
    "B": ("11110", "10001", "11110", "10001", "11110"),
    "C": ("01111", "10000", "10000", "10000", "01111"),
    "E": ("11111", "10000", "11110", "10000", "11111"),
    "N": ("10001", "11001", "10101", "10011", "10001"),
    "O": ("01110", "10001", "10001", "10001", "01110"),
    "R": ("11110", "10001", "11110", "10100", "10010"),
    "U": ("10001", "10001", "10001", "10001", "01110"),
}


def draw_pixel_word(draw, word, start_x, start_y, pixel, colors):
    for letter_index, character in enumerate(word):
        glyph = PREVIEW_GLYPHS[character]
        color = colors[letter_index % len(colors)]
        letter_x = start_x + letter_index * pixel * 6
        for row, line in enumerate(glyph):
            for column, value in enumerate(line):
                if value == "1":
                    x = letter_x + column * pixel
                    y = start_y + row * pixel
                    draw.rectangle((x, y, x + pixel - 2, y + pixel - 2), fill=color + (255,))


def make_preview():
    image = Image.new("RGBA", (1280, 720), (8, 18, 42, 255))
    draw = ImageDraw.Draw(image)

    # Pixel night sky and distant block clouds.
    rng = random.Random(801)
    for _ in range(75):
        x = rng.randrange(20, 1260)
        y = rng.randrange(90, 310)
        draw.rectangle((x, y, x + 4, y + 4), fill=(184, 218, 255, 255))
    for x, y in ((95, 150), (840, 120)):
        draw.rectangle((x, y, x + 250, y + 32), fill=(43, 58, 92, 255))
        draw.rectangle((x + 56, y - 28, x + 176, y + 32), fill=(52, 69, 105, 255))

    # Voxel grass courtyard and cobblestone path in perspective.
    draw.polygon([(42, 684), (352, 300), (928, 300), (1238, 684)], fill=(48, 113, 50, 255))
    for row in range(8):
        y = 326 + row * 48
        ratio = (y - 300) / 384
        left = int(352 - 310 * ratio)
        right = int(928 + 310 * ratio)
        draw.line((left, y, right, y), fill=(37, 86, 40, 255), width=3)
    draw.polygon([(498, 684), (570, 300), (710, 300), (782, 684)], fill=(89, 92, 97, 255), outline=(43, 45, 49, 255), width=5)
    for y in range(336, 685, 48):
        draw.line((505, y, 775, y), fill=(50, 52, 57, 255), width=4)

    # Main blackstone nightclub wall, roof and physical voxel mural.
    draw.rectangle((350, 126, 930, 350), fill=(24, 27, 37, 255), outline=(6, 8, 14, 255), width=8)
    draw.rectangle((326, 102, 954, 134), fill=(78, 29, 88, 255), outline=(35, 13, 42, 255), width=7)
    draw_pixel_word(draw, "BOUNCE", 404, 154, 12, (CYAN, LIME, MAGENTA))
    draw_pixel_word(draw, "CORE", 500, 228, 12, (MAGENTA, CYAN, LIME))
    draw.rectangle((376, 140, 904, 336), outline=LIME + (255,), width=7)

    # Block stage, DJ console and speaker towers.
    draw.polygon([(318, 418), (962, 418), (868, 330), (412, 330)], fill=(99, 104, 112, 255), outline=(47, 51, 58, 255), width=7)
    draw.rectangle((500, 318, 780, 404), fill=(15, 20, 31, 255), outline=CYAN + (255,), width=6)
    for index, height in enumerate((20, 42, 30, 58, 48, 70, 32, 56, 38, 64)):
        x = 526 + index * 24
        color = (CYAN, LIME, MAGENTA)[index % 3]
        draw.rectangle((x, 390 - height, x + 14, 390), fill=color + (255,))
    for x, color in ((332, CYAN), (852, MAGENTA)):
        draw.rectangle((x, 228, x + 90, 404), fill=(10, 12, 18, 255), outline=color + (255,), width=6)
        for center_y in (278, 354):
            draw.ellipse((x + 18, center_y - 30, x + 78, center_y + 30), fill=(25, 28, 34, 255), outline=(102, 108, 119, 255), width=5)

    # Timber team houses.
    for left, right, color in ((58, 322, CYAN), (958, 1222, MAGENTA)):
        draw.rectangle((left, 330, right, 610), fill=(117, 70, 39, 255), outline=(55, 34, 25, 255), width=8)
        draw.rectangle((left - 18, 306, right + 18, 350), fill=(73, 27, 82, 255), outline=(35, 13, 42, 255), width=7)
        draw.rectangle((left + 45, 402, right - 45, 520), fill=(14, 49, 66, 255), outline=color + (255,), width=7)
        draw.rectangle((left + 86, 520, right - 86, 610), fill=(87, 50, 31, 255), outline=(45, 27, 20, 255), width=7)

    # Trees are built from trunks and cubic leaf canopies.
    for x, y, scale in ((246, 226, 1.0), (1030, 220, 1.0), (180, 548, 0.82), (1090, 548, 0.82)):
        trunk_width = int(34 * scale)
        trunk_height = int(102 * scale)
        draw.rectangle((x, y, x + trunk_width, y + trunk_height), fill=(113, 68, 38, 255))
        leaf = int(84 * scale)
        draw.rectangle((x - leaf // 2, y - leaf // 2, x + trunk_width + leaf // 2, y + leaf // 2), fill=(42, 111, 48, 255))
        draw.rectangle((x - leaf // 3, y - leaf, x + trunk_width + leaf // 3, y), fill=(56, 137, 53, 255))

    draw.rectangle((0, 0, 1280, 92), fill=(2, 4, 11, 238))
    title_font = font(50)
    sub_font = font(23)
    draw.text((42, 18), "NEON VAULT: BLOCK PARTY", font=title_font, fill=(255, 255, 255, 255))
    draw.text((1010, 35), "FFA / TDM / CTF", font=sub_font, fill=LIME + (255,))
    draw.rectangle((0, 684, 1280, 720), fill=(2, 4, 11, 235))
    draw.text((42, 688), "AN ORIGINAL BOUNCECORE VOXEL ARENA", font=sub_font, fill=CYAN + (255,))
    return image


def make_cfg():
    relative_prefix = ASSET_PREFIX.removeprefix("packages/")
    return f"""// Bouncecore Neon Vault - original voxel nightclub arena
texturereset

setshader "stdworld"
texture 0 "{relative_prefix}/grass.png"
texture 0 "{relative_prefix}/dirt.png"
texture 0 "{relative_prefix}/stone.png"
texture 0 "{relative_prefix}/wood.png"
texture 0 "{relative_prefix}/leaves.png"
texture 0 "{relative_prefix}/glass.png"
texture 0 "{relative_prefix}/path.png"
texture 0 "{relative_prefix}/cyan.png"
texture 0 "{relative_prefix}/magenta.png"
texture 0 "{relative_prefix}/lime.png"
texture 0 "{relative_prefix}/speaker.png"
texture 0 "{relative_prefix}/booth.png"
texture 0 "{relative_prefix}/door.png"
texture 0 "{relative_prefix}/roof.png"
texture 0 "{relative_prefix}/sky.png"
texture 0 "{relative_prefix}/blackstone.png"

maptitle "{DISPLAY_NAME}"
ambient 68
skylight 88 104 142
fog 1500
fogcolour 8 18 42
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
        (png_bytes(make_grass()), f"{ASSET_PREFIX}/grass.png"),
        (png_bytes(make_dirt()), f"{ASSET_PREFIX}/dirt.png"),
        (png_bytes(make_stone()), f"{ASSET_PREFIX}/stone.png"),
        (png_bytes(make_wood()), f"{ASSET_PREFIX}/wood.png"),
        (png_bytes(make_leaves()), f"{ASSET_PREFIX}/leaves.png"),
        (png_bytes(make_glass()), f"{ASSET_PREFIX}/glass.png"),
        (png_bytes(make_path()), f"{ASSET_PREFIX}/path.png"),
        (png_bytes(make_neon_block(CYAN)), f"{ASSET_PREFIX}/cyan.png"),
        (png_bytes(make_neon_block(MAGENTA)), f"{ASSET_PREFIX}/magenta.png"),
        (png_bytes(make_neon_block(LIME)), f"{ASSET_PREFIX}/lime.png"),
        (png_bytes(make_speaker()), f"{ASSET_PREFIX}/speaker.png"),
        (png_bytes(make_booth()), f"{ASSET_PREFIX}/booth.png"),
        (png_bytes(make_door()), f"{ASSET_PREFIX}/door.png"),
        (png_bytes(make_roof()), f"{ASSET_PREFIX}/roof.png"),
        (png_bytes(make_sky()), f"{ASSET_PREFIX}/sky.png"),
        (png_bytes(make_blackstone()), f"{ASSET_PREFIX}/blackstone.png"),
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
                "Neon Vault is an original voxel block-party world with grass, "
                "trees, timber club houses, stone paths, a DJ stage, speakers "
                "and a wall-sized physical Bouncecore mural."
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
