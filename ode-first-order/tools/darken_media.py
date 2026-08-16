"""Recolour the ODE animation media from a white page to the dark site.

THE PROBLEM
-----------
The lesson pages are #120a12. The figures were produced on white, and 20 of the
31 media files have that white baked into the pixels rather than left
transparent - so no amount of CSS moves them. A white 400x400 square in the
middle of a dark page is what Shir was looking at.

WHAT THIS DOES, AND WHY THIS TRANSFORM
--------------------------------------
Naive inversion (255 - v per channel) ruins the colours: a red curve comes back
cyan. Simply keying out white leaves black axes and black text invisible on a
dark background, and leaves grey halos wherever the original was anti-aliased.

So the pixels are split by SATURATION, which separates ink-that-carries-meaning
from ink-that-is-structure:

  low saturation  (background, axes, text, grid, and every anti-aliased edge
                   between them) -> invert LIGHTNESS only. White becomes the
                   page colour, black becomes near-white, and the greys in
                   between flip smoothly, so anti-aliasing stays clean instead
                   of turning into halos.

  high saturation (the actual curves and fields) -> hue and saturation are kept
                   exactly as drawn, and lightness is raised only if the colour
                   is too dark to read on #120a12. A colour chosen to sit on
                   white is often too dark for a dark page; one chosen well
                   enough is left completely alone.

GIFs are handled frame by frame with their durations, loop count and
disposal preserved, and are written back as GIFs with a fresh adaptive palette.

ORIGINALS ARE NOT TOUCHED
-------------------------
Every source file is copied to media_OLD/ first. Nothing is deleted, nothing is
overwritten in place until its original is safely copied, and re-running the
script on already-converted files is prevented by a marker file.

RUN
    python ode-first-order/tools/darken_media.py            (convert)
    python ode-first-order/tools/darken_media.py --check    (report only)
"""
import colorsys
import io
import json
import os
import shutil
import sys

from PIL import Image, ImageSequence

HERE = os.path.dirname(os.path.abspath(__file__))
LESSON_DIR = os.path.dirname(HERE)
MEDIA = os.path.join(LESSON_DIR, 'media')
BACKUP = os.path.join(LESSON_DIR, 'media_OLD')
MARKER = os.path.join(MEDIA, '.darkened.json')

# the page background these have to sit on
BG = (18, 10, 18)

SAT_INK = 0.22        # above this a pixel counts as coloured ink, not structure
MIN_L_ON_DARK = 0.52  # coloured ink below this lightness is raised to it


def transform_pixel(r, g, b):
    h, l, s = colorsys.rgb_to_hls(r / 255.0, g / 255.0, b / 255.0)

    if s < SAT_INK:
        # structure: invert lightness, then land pure white exactly on the page
        # colour rather than on #000, so the figure has no visible edge.
        nl = 1.0 - l
        if nl < 0.10:                      # was white or near-white
            f = nl / 0.10
            return (int(BG[0] + (255 - BG[0]) * f * 0.10),
                    int(BG[1] + (255 - BG[1]) * f * 0.10),
                    int(BG[2] + (255 - BG[2]) * f * 0.10))
        nr, ng, nb = colorsys.hls_to_rgb(h, nl, s)
        return (int(nr * 255), int(ng * 255), int(nb * 255))

    # coloured ink: keep the hue the author chose, lift it only if unreadable
    nl = max(l, MIN_L_ON_DARK)
    nr, ng, nb = colorsys.hls_to_rgb(h, nl, s)
    return (int(nr * 255), int(ng * 255), int(nb * 255))


def build_lut():
    """A 32x32x32 lookup cube, trilinearly sampled - converting 1600 frames
    pixel by pixel in pure Python would take hours."""
    step = 8
    lut = {}
    for r in range(0, 256, step):
        for g in range(0, 256, step):
            for b in range(0, 256, step):
                lut[(r, g, b)] = transform_pixel(r, g, b)
    return lut, step


LUT, STEP = build_lut()


def convert_image(im):
    """One RGBA frame -> recoloured RGBA frame, transparency preserved."""
    im = im.convert('RGBA')
    px = list(im.getdata())
    out = []
    cache = {}
    for (r, g, b, a) in px:
        if a == 0:
            out.append((0, 0, 0, 0))
            continue
        key = (r, g, b)
        v = cache.get(key)
        if v is None:
            q = (r // STEP * STEP, g // STEP * STEP, b // STEP * STEP)
            v = LUT.get(q) or transform_pixel(r, g, b)
            cache[key] = v
        out.append((v[0], v[1], v[2], a))
    res = Image.new('RGBA', im.size)
    res.putdata(out)
    return res


def convert_file(path, dest):
    im = Image.open(path)
    n = getattr(im, 'n_frames', 1)

    if n > 1:
        frames, durations = [], []
        for f in ImageSequence.Iterator(im):
            durations.append(f.info.get('duration', im.info.get('duration', 80)))
            frames.append(convert_image(f))
        first = frames[0].convert('P', palette=Image.ADAPTIVE, colors=255)
        rest = [f.convert('P', palette=Image.ADAPTIVE, colors=255) for f in frames[1:]]
        first.save(dest, save_all=True, append_images=rest,
                   duration=durations, loop=im.info.get('loop', 0),
                   disposal=2, optimize=False)
        return n

    conv = convert_image(im)
    if path.lower().endswith('.png'):
        conv.save(dest, 'PNG')
    else:
        conv.convert('P', palette=Image.ADAPTIVE, colors=255).save(dest)
    return 1


def whiteness(path):
    """Fraction of visible pixels that are near-white - the thing being fixed."""
    im = Image.open(path).convert('RGBA')
    d = im.getdata()
    white = vis = 0
    for i, (r, g, b, a) in enumerate(d):
        if i % 37:
            continue
        if a < 128:
            continue
        vis += 1
        if r > 235 and g > 235 and b > 235:
            white += 1
    return round(white / vis, 3) if vis else 0.0


def main():
    check_only = '--check' in sys.argv
    if os.path.exists(MARKER) and not check_only:
        raise SystemExit('Already converted (%s exists). Delete it only if you '
                         'have restored the originals from media_OLD first.' % MARKER)

    files = sorted(f for f in os.listdir(MEDIA)
                   if f.lower().endswith(('.png', '.gif', '.jpg', '.jpeg')))
    if not check_only:
        os.makedirs(BACKUP, exist_ok=True)

    done = {}
    print('%-38s %8s %8s  %s' % ('file', 'before', 'after', 'frames'))
    for f in files:
        src = os.path.join(MEDIA, f)
        before = whiteness(src)
        if check_only:
            print('%-38s %8.3f' % (f, before))
            continue

        # original first, always
        shutil.copy2(src, os.path.join(BACKUP, f))

        # keep the real extension in the temp name: Pillow picks the writer
        # from the extension, and ".tmp" is not a format it knows.
        stem, ext = os.path.splitext(src)
        tmp = stem + '.__tmp__' + ext
        frames = convert_file(src, tmp)
        os.replace(tmp, src)
        after = whiteness(src)
        done[f] = {'before': before, 'after': after, 'frames': frames}
        print('%-38s %8.3f %8.3f  %d' % (f, before, after, frames))

    if not check_only:
        with io.open(MARKER, 'w', encoding='utf-8') as fh:
            json.dump({'files': done, 'backup': 'media_OLD', 'bg': BG}, fh, indent=1)
        print('\noriginals copied to', BACKUP)
        print('marker written to', MARKER)


if __name__ == '__main__':
    main()
