import struct
import zlib
import os

def create_png(width, height, rgba_data):
    """Encodes a list of (r, g, b, a) tuples into PNG byte string."""
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xFFFFFFFF)

    raw = bytearray()
    for y in range(height):
        raw.append(0) # filter type 0: None
        row_offset = y * width
        for x in range(width):
            r, g, b, a = rgba_data[row_offset + x]
            raw.extend((r, g, b, a))

    ihdr = struct.pack('>IIBBBBB', width, height, 8, 6, 0, 0, 0)
    idat = zlib.compress(bytes(raw), 9)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr) + chunk(b'IDAT', idat) + chunk(b'IEND', b'')

# Color Palette matching user's uploaded pixel bunny image
# . = Transparent
# B = Sky Blue Outline (#68aee5)
# L = Light Ice Blue Inner Highlight (#d8f0fd)
# W = White Fur (#ffffff)
# P = Soft Pink Ear/Cheek (#f6b7c5)
# E = Eye Deep Blue (#2b73b5)
# H = Eye White Shine (#ffffff)
# N = Nose/Mouth Sky Blue (#68aee5)
PALETTE = {
    '.': (0, 0, 0, 0),
    'B': (104, 174, 229, 255),
    'L': (216, 240, 253, 255),
    'W': (255, 255, 255, 255),
    'P': (246, 183, 197, 255),
    'E': (43, 115, 181, 255),
    'H': (255, 255, 255, 255),
    'N': (104, 174, 229, 255),
}

# 32x32 pixel representation of the user's uploaded pixel rabbit head
PIXEL_GRID = [
    "................................", # 0
    "................................", # 1
    "................................", # 2
    "................................", # 3
    "........BBBB........BBBB........", # 4
    ".......BLLLLB......BLLLLB.......", # 5
    "......BLWWWWLB....BLWWWWLB......", # 6
    ".....BLWWPPWWLB..BLWWPPWWLB.....", # 7
    ".....BLWWPPWWLB..BLWWPPWWLB.....", # 8
    ".....BLWWPPWWLB..BLWWPPWWLB.....", # 9
    ".....BLWWPPWWLB..BLWWPPWWLB.....", # 10
    ".....BLWWPPWWLB..BLWWPPWWLB.....", # 11
    ".....BLWWWWWWLB..BLWWWWWWLB.....", # 12
    ".....BLWWWWWWLBBBBBLWWWWWWLB....", # 13
    "......BLLLLLLWWWWWWLLLLLLB......", # 14
    "......BWWWWWWWWWWWWWWWWWB.......", # 15
    "....BBLLWWWWWWWWWWWWWWLLBB......", # 16
    "...BLWWWWWWWWWWWWWWWWWWWWLB.....", # 17
    "..BLWWWWWWWWWWWWWWWWWWWWWWLB....", # 18
    "..BLWWWWWWWWWWWWWWWWWWWWWWLB....", # 19
    ".BLWWWWHEWWWWWWWWWWWWHEWWWWLB...", # 20 (Eyes with shine)
    ".BLWWWWEEWWWWNNWWWWWWEEWWWWLB...", # 21 (Eyes + Nose bar)
    ".BLWWPPWWWWWWWNWWWWWWWWPPWWLB...", # 22 (Cheeks + Nose tip)
    ".BLWWPPWWWWWWWWWWWWWWWWPPWWLB...", # 23 (Cheeks)
    "..BLWWWWWWWWWWWWWWWWWWWWWWLB....", # 24
    "..BLWWWWWWWWWWWWWWWWWWWWWWLB....", # 25
    "...BLWWWWWWWWWWWWWWWWWWWWLB.....", # 26
    "....BLLWWWWWWWWWWWWWWWWLLB......", # 27
    ".....BBBLLLLLLLLLLLLLLBBB.......", # 28
    "........BBBBBBBBBBBBBB..........", # 29
    "................................", # 30
    "................................", # 31
]

def render_scaled(target_size, bg_color=(0, 0, 0, 0), padding=0):
    grid_h = len(PIXEL_GRID)
    grid_w = len(PIXEL_GRID[0])

    available_size = target_size - (padding * 2)
    scale = available_size // grid_w
    art_w = grid_w * scale
    art_h = grid_h * scale

    start_x = (target_size - art_w) // 2
    start_y = (target_size - art_h) // 2

    rgba_data = [bg_color] * (target_size * target_size)

    for gy in range(grid_h):
        for gx in range(grid_w):
            char = PIXEL_GRID[gy][gx]
            color = PALETTE.get(char, (0, 0, 0, 0))
            if color[3] == 0 and bg_color[3] != 0:
                continue

            # Draw block of size (scale x scale)
            for dy in range(scale):
                py = start_y + gy * scale + dy
                if 0 <= py < target_size:
                    for dx in range(scale):
                        px = start_x + gx * scale + dx
                        if 0 <= px < target_size:
                            if color[3] == 0:
                                rgba_data[py * target_size + px] = bg_color
                            else:
                                rgba_data[py * target_size + px] = color

    return create_png(target_size, target_size, rgba_data)

os.makedirs('public/icons', exist_ok=True)

# 1. 192x192 standard icon (purpose: any)
png_192 = render_scaled(192, bg_color=(255, 255, 255, 0), padding=0)
with open('public/icons/icon-192.png', 'wb') as f:
    f.write(png_192)

# 2. 512x512 standard icon (purpose: any)
png_512 = render_scaled(512, bg_color=(255, 255, 255, 0), padding=0)
with open('public/icons/icon-512.png', 'wb') as f:
    f.write(png_512)

# 3. 512x512 maskable icon for Android (purpose: maskable)
# Android maskable icons need ~15% padding with solid background so squircle/circle masks don't cut ears
png_maskable = render_scaled(512, bg_color=(240, 249, 255, 255), padding=56)
with open('public/icons/icon-maskable-512.png', 'wb') as f:
    f.write(png_maskable)

# 4. Apple touch icon 180x180 (iOS requires solid background)
png_apple = render_scaled(180, bg_color=(255, 255, 255, 255), padding=10)
with open('public/icons/apple-touch-icon.png', 'wb') as f:
    f.write(png_apple)

# 5. Favicon 32x32 and 16x16
png_32 = render_scaled(32, bg_color=(255, 255, 255, 0), padding=0)
with open('public/icons/favicon-32.png', 'wb') as f:
    f.write(png_32)
with open('public/favicon.ico', 'wb') as f:
    f.write(png_32) # Standard PNG-in-ICO format or png favicon

print("Successfully generated all PWA icons in public/icons/!")
