#!/usr/bin/env python3

import hashlib
import io
import os
import random
from pathlib import Path

import cbor2
from PIL import Image, ImageDraw, ImageFont

MAP_NAME = "blocklands"
DISPLAY_NAME = "Bouncecore Blocklands"
ASSET_PREFIX = "packages/bouncecore/blocklands"
MAP_PREFIX = f"packages/base/{MAP_NAME}"

CYAN = (0, 204, 244)
MAGENTA = (238, 42, 154)
GRASS = (83, 146, 52)
DIRT = (119, 79, 48)
STONE = (118, 121, 124)
OAK = (145, 103, 57)
LEAF = (58, 125, 48)
SKY = (104, 178, 234)


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


def vary(color, amount):
    return tuple(clamp_channel(channel + amount) for channel in color)


def noisy_tile(base, seed, square=16, amount=18):
    image = Image.new("RGBA", (512, 512), base + (255,))
    draw = ImageDraw.Draw(image)
    rng = random.Random(seed)
    for y in range(0, 512, square):
        for x in range(0, 512, square):
            color = vary(base, rng.randint(-amount, amount))
            draw.rectangle((x, y, x + square - 1, y + square - 1), fill=color + (255,))
    return image


def make_grass():
    image = noisy_tile(GRASS, 1101, amount=22)
    draw = ImageDraw.Draw(image)
    rng = random.Random(1102)
    for _ in range(180):
        x = rng.randrange(32) * 16
        y = rng.randrange(32) * 16
        color = (115, 174, 64) if rng.random() > 0.45 else (45, 105, 43)
        draw.rectangle((x + 2, y + 2, x + 9, y + 9), fill=color + (255,))
    return image


def make_dirt():
    image = noisy_tile(DIRT, 1201, amount=24)
    draw = ImageDraw.Draw(image)
    rng = random.Random(1202)
    for _ in range(160):
        x = rng.randrange(32) * 16
        y = rng.randrange(32) * 16
        color = (77, 49, 34) if rng.random() > 0.5 else (153, 106, 63)
        draw.rectangle((x + 3, y + 3, x + 11, y + 11), fill=color + (255,))
    return image


def make_stone():
    image = noisy_tile(STONE, 1301, amount=24)
    draw = ImageDraw.Draw(image)
    rng = random.Random(1302)
    for _ in range(110):
        x = rng.randrange(32) * 16
        y = rng.randrange(32) * 16
        color = (88, 91, 95) if rng.random() > 0.5 else (151, 153, 154)
        draw.rectangle((x + 2, y + 2, x + 10, y + 8), fill=color + (255,))
    return image


def make_cobblestone():
    image = Image.new("RGBA", (512, 512), (73, 77, 79, 255))
    draw = ImageDraw.Draw(image)
    rng = random.Random(1401)
    for row, y in enumerate(range(0, 512, 64)):
        offset = -32 if row % 2 else 0
        for x in range(offset, 512, 80):
            color = vary((117, 121, 124), rng.randint(-18, 20))
            draw.rounded_rectangle(
                (x + 3, y + 3, x + 75, y + 59),
                radius=9,
                fill=color + (255,),
                outline=(57, 60, 62, 255),
                width=5,
            )
            draw.line(
                (x + 14, y + 13, x + 61, y + 13),
                fill=vary(color, 24) + (255,),
                width=4,
            )
    return image


def make_oak_log():
    image = Image.new("RGBA", (512, 512), (89, 61, 35, 255))
    draw = ImageDraw.Draw(image)
    rng = random.Random(1501)
    for x in range(0, 512, 64):
        color = vary((111, 76, 40), rng.randint(-12, 16))
        draw.rectangle((x + 4, 0, x + 59, 512), fill=color + (255,))
        draw.rectangle((x, 0, x + 5, 512), fill=(68, 45, 28, 255))
        for y in range(24, 512, 96):
            draw.rectangle((x + 17, y, x + 43, y + 8), fill=vary(color, -28) + (255,))
    return image


def make_oak_planks():
    image = Image.new("RGBA", (512, 512), OAK + (255,))
    draw = ImageDraw.Draw(image)
    rng = random.Random(1601)
    for row, y in enumerate(range(0, 512, 64)):
        offset = -64 if row % 2 else 0
        for x in range(offset, 512, 128):
            color = vary(OAK, rng.randint(-16, 18))
            draw.rectangle(
                (x + 3, y + 3, x + 123, y + 59),
                fill=color + (255,),
                outline=(76, 51, 31, 255),
                width=4,
            )
            draw.line((x + 16, y + 15, x + 108, y + 15), fill=vary(color, 28) + (255,), width=4)
            draw.rectangle((x + 90, y + 36, x + 101, y + 43), fill=vary(color, -27) + (255,))
    return image


def make_leaves():
    image = noisy_tile(LEAF, 1701, amount=28)
    draw = ImageDraw.Draw(image)
    rng = random.Random(1702)
    for _ in range(150):
        x = rng.randrange(32) * 16
        y = rng.randrange(32) * 16
        color = (91, 158, 59) if rng.random() > 0.5 else (32, 88, 39)
        draw.rectangle((x, y + 3, x + 14, y + 11), fill=color + (255,))
    return image


def make_glass():
    image = Image.new("RGBA", (512, 512), (72, 151, 180, 255))
    draw = ImageDraw.Draw(image)
    for position in range(0, 513, 64):
        draw.line((position, 0, position, 512), fill=(196, 232, 238, 255), width=7)
        draw.line((0, position, 512, position), fill=(196, 232, 238, 255), width=7)
    for y in range(8, 512, 64):
        for x in range(8, 512, 64):
            draw.rectangle((x, y, x + 48, y + 48), fill=(87, 166, 190, 255))
            draw.rectangle((x + 8, y + 7, x + 15, y + 35), fill=(205, 242, 247, 255))
    return image


def make_sand():
    image = noisy_tile((211, 194, 127), 1801, amount=18)
    draw = ImageDraw.Draw(image)
    rng = random.Random(1802)
    for _ in range(130):
        x = rng.randrange(512)
        y = rng.randrange(512)
        draw.rectangle((x, y, x + 5, y + 5), fill=(174, 154, 92, 255))
    return image


def make_water():
    image = Image.new("RGBA", (512, 512), (38, 112, 185, 255))
    draw = ImageDraw.Draw(image)
    for y in range(16, 512, 48):
        offset = 24 if (y // 48) % 2 else 0
        for x in range(-32 + offset, 512, 96):
            draw.rectangle((x, y, x + 57, y + 8), fill=(71, 158, 218, 255))
            draw.rectangle((x + 16, y + 11, x + 75, y + 16), fill=(29, 91, 163, 255))
    return image


def make_bricks():
    image = Image.new("RGBA", (512, 512), (86, 56, 45, 255))
    draw = ImageDraw.Draw(image)
    rng = random.Random(1901)
    for row, y in enumerate(range(0, 512, 64)):
        offset = -48 if row % 2 else 0
        for x in range(offset, 512, 96):
            color = vary((151, 82, 57), rng.randint(-16, 14))
            draw.rectangle(
                (x + 4, y + 4, x + 91, y + 59),
                fill=color + (255,),
                outline=(75, 48, 40, 255),
                width=5,
            )
    return image


def make_roof_tiles():
    image = Image.new("RGBA", (512, 512), (74, 36, 33, 255))
    draw = ImageDraw.Draw(image)
    for row, y in enumerate(range(0, 512, 48)):
        offset = -32 if row % 2 else 0
        for x in range(offset, 512, 64):
            color = (137, 57, 48) if row % 2 else (119, 48, 43)
            draw.rectangle(
                (x + 2, y + 2, x + 61, y + 44),
                fill=color + (255,),
                outline=(65, 29, 29, 255),
                width=5,
            )
            draw.rectangle((x + 9, y + 8, x + 51, y + 14), fill=(174, 78, 62, 255))
    return image


def make_path():
    image = Image.new("RGBA", (512, 512), (102, 94, 75, 255))
    draw = ImageDraw.Draw(image)
    rng = random.Random(2001)
    for y in range(0, 512, 64):
        for x in range(0, 512, 64):
            color = vary((128, 118, 91), rng.randint(-15, 16))
            draw.rounded_rectangle(
                (x + 3, y + 3, x + 60, y + 60),
                radius=9,
                fill=color + (255,),
                outline=(76, 70, 59, 255),
                width=4,
            )
    return image


def make_farmland():
    image = Image.new("RGBA", (512, 512), (78, 48, 31, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, 512, 32):
        color = (102, 61, 36) if (y // 32) % 2 else (88, 52, 33)
        draw.rectangle((0, y + 2, 512, y + 27), fill=color + (255,))
        draw.line((0, y + 27, 512, y + 27), fill=(50, 31, 23, 255), width=4)
    return image


def make_wheat():
    image = Image.new("RGBA", (512, 512), (170, 137, 45, 255))
    draw = ImageDraw.Draw(image)
    for x in range(16, 512, 48):
        draw.rectangle((x, 80, x + 10, 512), fill=(108, 117, 42, 255))
        for y in range(48, 350, 64):
            draw.polygon([(x + 5, y), (x - 15, y + 32), (x + 5, y + 23)], fill=(229, 189, 69, 255))
            draw.polygon([(x + 5, y), (x + 25, y + 32), (x + 5, y + 23)], fill=(205, 163, 53, 255))
    return image


def make_door():
    image = Image.new("RGBA", (512, 512), (72, 45, 27, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((20, 10, 492, 502), fill=(112, 70, 39, 255), outline=(52, 31, 21, 255), width=12)
    for y in (32, 148, 264, 380):
        draw.rectangle((48, y, 464, y + 88), fill=(142, 91, 48, 255), outline=(64, 39, 25, 255), width=7)
        draw.rectangle((64, y + 13, 448, y + 27), fill=(172, 118, 66, 255))
    draw.rectangle((402, 244, 444, 286), fill=(195, 161, 58, 255), outline=(78, 59, 22, 255), width=5)
    return image


def make_torch():
    image = Image.new("RGBA", (512, 512), (62, 39, 26, 255))
    draw = ImageDraw.Draw(image)
    draw.rectangle((224, 192, 288, 512), fill=(130, 84, 40, 255))
    draw.rectangle((208, 176, 304, 208), fill=(88, 52, 29, 255))
    for size, color in ((150, (255, 111, 28)), (108, (255, 184, 42)), (60, (255, 245, 145))):
        left = 256 - size // 2
        draw.rectangle((left, 44 + (150 - size) // 2, left + size, 176), fill=color + (255,))
    return image


def make_wool(color):
    image = noisy_tile(color, sum(color), square=16, amount=18)
    draw = ImageDraw.Draw(image)
    for y in range(0, 512, 64):
        for x in range(0, 512, 64):
            draw.rectangle((x + 3, y + 3, x + 60, y + 60), outline=vary(color, -55) + (255,), width=4)
            draw.line((x + 10, y + 13, x + 48, y + 13), fill=vary(color, 36) + (255,), width=4)
    return image


def make_coal_ore():
    image = make_stone()
    draw = ImageDraw.Draw(image)
    rng = random.Random(2101)
    for _ in range(70):
        x = rng.randrange(32) * 16
        y = rng.randrange(32) * 16
        draw.rectangle((x + 2, y + 2, x + 13, y + 13), fill=(31, 33, 36, 255))
        draw.rectangle((x + 5, y + 4, x + 9, y + 8), fill=(64, 67, 70, 255))
    return image


def make_iron():
    image = Image.new("RGBA", (512, 512), (154, 158, 160, 255))
    draw = ImageDraw.Draw(image)
    for y in range(0, 512, 64):
        for x in range(0, 512, 64):
            draw.rectangle((x + 3, y + 3, x + 60, y + 60), fill=(173, 177, 179, 255), outline=(93, 98, 101, 255), width=5)
            draw.rectangle((x + 12, y + 10, x + 48, y + 17), fill=(215, 219, 220, 255))
            draw.rectangle((x + 25, y + 26, x + 38, y + 39), fill=(111, 116, 119, 255))
    return image


def make_sky():
    image = Image.new("RGBA", (512, 512), SKY + (255,))
    draw = ImageDraw.Draw(image)
    for x, y, width in ((28, 92, 196), (278, 238, 178), (75, 382, 220)):
        draw.rectangle((x, y, x + width, y + 34), fill=(239, 246, 248, 255))
        draw.rectangle((x + 38, y - 18, x + width - 44, y + 49), fill=(250, 252, 252, 255))
    return image


PREVIEW_GLYPHS = {
    "B": ("110", "101", "110", "101", "110"),
    "C": ("111", "100", "100", "100", "111"),
    "E": ("111", "100", "110", "100", "111"),
    "N": ("101", "111", "111", "111", "101"),
    "O": ("111", "101", "101", "101", "111"),
    "R": ("110", "101", "110", "101", "101"),
    "U": ("101", "101", "101", "101", "111"),
}


def draw_pixel_word(draw, word, start_x, start_y, pixel):
    for letter_index, character in enumerate(word):
        glyph = PREVIEW_GLYPHS[character]
        color = CYAN if letter_index % 2 == 0 else MAGENTA
        letter_x = start_x + letter_index * pixel * 4
        for row, line in enumerate(glyph):
            for column, value in enumerate(line):
                if value == "1":
                    x = letter_x + column * pixel
                    y = start_y + row * pixel
                    draw.rectangle((x, y, x + pixel - 2, y + pixel - 2), fill=color + (255,))


def draw_tree(draw, x, y, scale=1.0):
    trunk_w = int(34 * scale)
    trunk_h = int(112 * scale)
    leaf = int(76 * scale)
    draw.rectangle((x, y, x + trunk_w, y + trunk_h), fill=(104, 68, 37, 255), outline=(59, 39, 25, 255), width=5)
    draw.rectangle((x - leaf, y - leaf // 2, x + trunk_w + leaf, y + leaf // 2), fill=(53, 119, 48, 255), outline=(31, 78, 36, 255), width=5)
    draw.rectangle((x - leaf // 2, y - leaf, x + trunk_w + leaf // 2, y + leaf // 3), fill=(72, 145, 55, 255), outline=(31, 78, 36, 255), width=5)


def make_preview():
    image = Image.new("RGBA", (1280, 720), SKY + (255,))
    draw = ImageDraw.Draw(image)

    # Bright block-world sky and square clouds.
    for x, y, width in ((70, 120, 240), (840, 104, 300), (470, 170, 180)):
        draw.rectangle((x, y, x + width, y + 34), fill=(241, 247, 249, 255))
        draw.rectangle((x + 42, y - 28, x + width - 48, y + 48), fill=(252, 253, 253, 255))

    # Distant stepped hills.
    draw.polygon([(0, 390), (0, 290), (150, 290), (150, 252), (290, 252), (290, 390)], fill=(71, 132, 55, 255))
    draw.polygon([(990, 390), (990, 248), (1110, 248), (1110, 286), (1280, 286), (1280, 390)], fill=(67, 126, 52, 255))
    draw.rectangle((0, 354, 1280, 720), fill=(75, 140, 54, 255))

    # River and sand banks in perspective.
    draw.polygon([(455, 720), (544, 354), (640, 354), (735, 720)], fill=(206, 190, 127, 255))
    draw.polygon([(486, 720), (565, 354), (619, 354), (700, 720)], fill=(40, 119, 191, 255))
    for y in range(402, 700, 52):
        draw.line((520, y, 670, y), fill=(77, 168, 220, 255), width=5)

    # Castle wall and full-width block-built Bouncecore mural.
    draw.rectangle((256, 166, 1024, 370), fill=(116, 120, 124, 255), outline=(64, 68, 70, 255), width=8)
    draw.rectangle((224, 132, 330, 390), fill=(109, 113, 117, 255), outline=(58, 62, 65, 255), width=8)
    draw.rectangle((950, 132, 1056, 390), fill=(109, 113, 117, 255), outline=(58, 62, 65, 255), width=8)
    for x in range(240, 1040, 72):
        draw.rectangle((x, 126, x + 38, 166), fill=(127, 131, 134, 255), outline=(62, 66, 69, 255), width=5)
    draw_pixel_word(draw, "BOUNCECORE", 320, 206, 15)
    draw.rectangle((570, 286, 710, 370), fill=(40, 43, 45, 255), outline=(192, 196, 198, 255), width=8)

    # Oak village houses with stone foundations, glass and brick roofs.
    for left, right in ((38, 324), (956, 1242)):
        draw.rectangle((left, 402, right, 640), fill=(146, 103, 57, 255), outline=(73, 49, 30, 255), width=8)
        draw.rectangle((left - 14, 624, right + 14, 656), fill=(113, 117, 119, 255), outline=(60, 63, 65, 255), width=6)
        draw.rectangle((left - 22, 372, right + 22, 418), fill=(141, 59, 49, 255), outline=(72, 32, 29, 255), width=7)
        for frame_x in (left + 18, right - 42):
            draw.rectangle((frame_x, 402, frame_x + 24, 640), fill=(102, 66, 36, 255))
        draw.rectangle((left + 72, 466, right - 72, 550), fill=(75, 154, 184, 255), outline=(205, 237, 241, 255), width=7)
        draw.rectangle((left + 110, 550, right - 110, 640), fill=(116, 72, 39, 255), outline=(59, 38, 24, 255), width=6)

    # Timber bridge over the river.
    draw.polygon([(394, 572), (474, 474), (710, 474), (790, 572)], fill=(148, 104, 57, 255), outline=(76, 51, 31, 255))
    for x in range(430, 760, 48):
        draw.line((x, 492, x - 34, 558), fill=(89, 58, 34, 255), width=5)

    # Farm rows and block trees.
    draw.polygon([(82, 700), (232, 560), (414, 560), (372, 700)], fill=(92, 53, 31, 255), outline=(61, 38, 26, 255), width=5)
    for x in range(130, 380, 44):
        draw.line((x, 574, x - 35, 688), fill=(214, 174, 55, 255), width=12)
    draw_tree(draw, 188, 300, 0.9)
    draw_tree(draw, 1082, 310, 0.9)
    draw_tree(draw, 874, 520, 0.68)

    # Mine mouth cut into the southern stone mound.
    draw.polygon([(752, 720), (812, 568), (990, 568), (1054, 720)], fill=(104, 108, 111, 255), outline=(55, 59, 61, 255), width=7)
    draw.rectangle((858, 600, 948, 720), fill=(31, 33, 35, 255), outline=(86, 58, 34, 255), width=9)

    draw.rectangle((0, 0, 1280, 94), fill=(20, 28, 36, 238))
    draw.text((38, 18), "BOUNCECORE BLOCKLANDS", font=font(48), fill=(255, 255, 255, 255))
    draw.text((1010, 35), "FFA / TDM / CTF", font=font(22), fill=(236, 241, 244, 255))
    draw.rectangle((0, 684, 1280, 720), fill=(20, 28, 36, 238))
    draw.text((38, 688), "ORIGINAL VOXEL VILLAGE, CASTLE, FOREST, FARM AND MINE", font=font(21), fill=(255, 255, 255, 255))
    return image


def make_cfg():
    relative_prefix = ASSET_PREFIX.removeprefix("packages/")
    return f"""// Bouncecore Blocklands - original voxel overworld arena
texturereset

setshader "stdworld"
texture 0 "{relative_prefix}/grass.png"
texture 0 "{relative_prefix}/dirt.png"
texture 0 "{relative_prefix}/stone.png"
texture 0 "{relative_prefix}/cobblestone.png"
texture 0 "{relative_prefix}/oak-log.png"
texture 0 "{relative_prefix}/oak-planks.png"
texture 0 "{relative_prefix}/leaves.png"
texture 0 "{relative_prefix}/glass.png"
texture 0 "{relative_prefix}/sand.png"
texture 0 "{relative_prefix}/water.png"
texture 0 "{relative_prefix}/bricks.png"
texture 0 "{relative_prefix}/roof-tiles.png"
texture 0 "{relative_prefix}/path.png"
texture 0 "{relative_prefix}/farmland.png"
texture 0 "{relative_prefix}/wheat.png"
texture 0 "{relative_prefix}/door.png"
texture 0 "{relative_prefix}/torch.png"
texture 0 "{relative_prefix}/cyan-wool.png"
texture 0 "{relative_prefix}/magenta-wool.png"
texture 0 "{relative_prefix}/coal-ore.png"
texture 0 "{relative_prefix}/iron.png"
texture 0 "{relative_prefix}/sky.png"

maptitle "{DISPLAY_NAME}"
ambient 92
skylight 156 178 196
fog 1700
fogcolour 104 178 234
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
    map_path = Path(os.environ.get("CORE_FPS_BLOCKLANDS_OGZ", "/tmp/blocklands.ogz"))
    index_path = asset_root / ".index.source"

    if not map_path.exists():
        raise RuntimeError(f"Generated Blocklands arena is missing: {map_path}")

    index = cbor2.loads(index_path.read_bytes())
    payloads = [
        (map_path.read_bytes(), f"{MAP_PREFIX}.ogz"),
        (make_cfg().encode("utf-8"), f"{MAP_PREFIX}.cfg"),
        (png_bytes(make_grass()), f"{ASSET_PREFIX}/grass.png"),
        (png_bytes(make_dirt()), f"{ASSET_PREFIX}/dirt.png"),
        (png_bytes(make_stone()), f"{ASSET_PREFIX}/stone.png"),
        (png_bytes(make_cobblestone()), f"{ASSET_PREFIX}/cobblestone.png"),
        (png_bytes(make_oak_log()), f"{ASSET_PREFIX}/oak-log.png"),
        (png_bytes(make_oak_planks()), f"{ASSET_PREFIX}/oak-planks.png"),
        (png_bytes(make_leaves()), f"{ASSET_PREFIX}/leaves.png"),
        (png_bytes(make_glass()), f"{ASSET_PREFIX}/glass.png"),
        (png_bytes(make_sand()), f"{ASSET_PREFIX}/sand.png"),
        (png_bytes(make_water()), f"{ASSET_PREFIX}/water.png"),
        (png_bytes(make_bricks()), f"{ASSET_PREFIX}/bricks.png"),
        (png_bytes(make_roof_tiles()), f"{ASSET_PREFIX}/roof-tiles.png"),
        (png_bytes(make_path()), f"{ASSET_PREFIX}/path.png"),
        (png_bytes(make_farmland()), f"{ASSET_PREFIX}/farmland.png"),
        (png_bytes(make_wheat()), f"{ASSET_PREFIX}/wheat.png"),
        (png_bytes(make_door()), f"{ASSET_PREFIX}/door.png"),
        (png_bytes(make_torch()), f"{ASSET_PREFIX}/torch.png"),
        (png_bytes(make_wool(CYAN)), f"{ASSET_PREFIX}/cyan-wool.png"),
        (png_bytes(make_wool(MAGENTA)), f"{ASSET_PREFIX}/magenta-wool.png"),
        (png_bytes(make_coal_ore()), f"{ASSET_PREFIX}/coal-ore.png"),
        (png_bytes(make_iron()), f"{ASSET_PREFIX}/iron.png"),
        (png_bytes(make_sky()), f"{ASSET_PREFIX}/sky.png"),
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
            "desktop": False,
            "web": False,
            "assets": assets,
        }
    )

    index["maps"] = [
        game_map
        for game_map in index["maps"]
        if game_map.get("name") not in {MAP_NAME, "neonvault"}
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
                "Bouncecore Blocklands is an original outdoor voxel world with "
                "stepped terrain, a river and timber bridge, oak village houses, "
                "a farm, forest, mine, stone castle and block-built mural."
            ),
        }
    )

    index_path.write_bytes(cbor2.dumps(index))
    (asset_root / ".bouncecore-blocklands").write_text(
        f"{DISPLAY_NAME} {ogz_hash}\n",
        encoding="ascii",
    )


if __name__ == "__main__":
    main()
