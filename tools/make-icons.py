"""Regenerates the app icons. Run: python3 tools/make-icons.py (needs Pillow)."""
from PIL import Image, ImageDraw
import os

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')
FELT = (18, 53, 43, 255)
SAFFRON = (242, 167, 27, 255)


def spade(draw, cx, cy, size, fill):
    """Draws a simple spade centred on cx, cy. size is the full height."""
    s = size
    r = s * 0.24
    # two lobes
    draw.ellipse([cx - 2 * r + r * 0.15, cy - r * 0.35, cx + r * 0.15, cy + r * 1.65], fill=fill)
    draw.ellipse([cx - r * 0.15, cy - r * 0.35, cx + 2 * r - r * 0.15, cy + r * 1.65], fill=fill)
    # point
    draw.polygon([(cx, cy - s * 0.5), (cx - 2 * r + r * 0.05, cy + r * 0.45), (cx + 2 * r - r * 0.05, cy + r * 0.45)], fill=fill)
    # stem
    draw.polygon([(cx, cy + r * 0.5), (cx - r * 0.7, cy + s * 0.5), (cx + r * 0.7, cy + s * 0.5)], fill=fill)


def make(size, maskable=False):
    img = Image.new('RGBA', (size, size), FELT if maskable else (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if not maskable:
        d.rounded_rectangle([0, 0, size - 1, size - 1], radius=int(size * 0.22), fill=FELT)
    scale = 0.46 if maskable else 0.52
    spade(d, size / 2, size * 0.5, size * scale, SAFFRON)
    return img


os.makedirs(OUT, exist_ok=True)
make(192).save(os.path.join(OUT, 'icon-192.png'))
make(512).save(os.path.join(OUT, 'icon-512.png'))
make(512, True).save(os.path.join(OUT, 'maskable-512.png'))
# iOS wants an opaque square, it rounds the corners itself
ios = Image.new('RGBA', (180, 180), FELT)
spade(ImageDraw.Draw(ios), 90, 90, 180 * 0.5, SAFFRON)
ios.convert('RGB').save(os.path.join(OUT, 'apple-touch-icon.png'))

svg = '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#12352B"/><path transform="translate(14 12) scale(1.8)" fill="#F2A71B" d="M12 2C9.5 6 3.5 9.5 3.5 14.2a4.3 4.3 0 0 0 7.6 2.8C11 19 10.4 20.8 9 22h6c-1.4-1.2-2-3-2.1-5a4.3 4.3 0 0 0 7.6-2.8C20.5 9.5 14.5 6 12 2z"/></svg>'''
open(os.path.join(OUT, 'favicon.svg'), 'w').write(svg)
print('icons written to', os.path.abspath(OUT))
