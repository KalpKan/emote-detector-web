#!/usr/bin/env python3
"""
Builds the named fake-camera clips used by scripts/e2e-camera.mjs (real pipeline)
and by scripts/extract_video_landmarks.py (VIDEO-mode landmark fixtures in
tests/fixtures/video/). Same recipe as scripts/build_e2e_clip.py: a slideshow of
real photos from the read-only, uncommitted gesture corpus, 640x480 letterboxed,
30 fps MJPEG. A still id may carry a suffix: "~" mirrored, "^" shrunk to 55 %
(a far subject). Needs only Pillow.

  python3 scripts/build_e2e_clips.py OUT_DIR NAME [NAME ...]     (NAME = all for every clip)

Writes OUT_DIR/e2e-<name>.mjpeg (never commit: stock photos) and
OUT_DIR/e2e-<name>-labels.json (ground truth in the e2e-labels.json format).
"""
import io
import json
import os
import sys

from PIL import Image, ImageOps

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
STILLS = os.path.join(REPO, "tests", "fixtures", "stills")
SRC = os.path.expanduser("~/Desktop/Out and About/Sidequest/Clash Royale Emote Bot/data/raw/gestures")
FPS = 30
W, H = 640, 480
REST = "angry-04"
POS = {"thumbs_up", "flex", "yawn"}

CLIPS = {
    # TEST round 1 (docs/reports/emotes.md): hard negatives, the round-1 misses, a repeated thumbs-up.
    "hard": [(REST, 2.0), ("cover_eyes-02", 2.5), (REST, 2.0), ("dab-01", 2.5), (REST, 2.0), ("angry-01", 2.5), (REST, 2.0), ("yawn-08", 2.5), (REST, 2.0), ("angry-07", 2.5), (REST, 2.0)],
    "misses": [(REST, 2.0), ("thumbs_up-04", 2.5), (REST, 2.0), ("thumbs_up-09", 2.5), (REST, 2.0), ("yawn-05", 2.5), (REST, 2.0), ("yawn-02", 2.5), (REST, 2.0), ("thumbs_up-16", 2.5), (REST, 2.0)],
    "repeat": [(REST, 1.5), ("thumbs_up-07", 2.0), (REST, 1.3), ("thumbs_up-07", 2.0), (REST, 1.3), ("thumbs_up-07", 2.0), (REST, 1.5)],
    # TEST round 2: the beside-the-head thumbs-up four times (D1), back-to-back gestures (D2), and the rest.
    "tu04x4": [(REST, 2.0), ("thumbs_up-04", 2.5)] * 4 + [(REST, 1.0)],
    "tu17x4": [(REST, 2.0), ("thumbs_up-17", 2.5)] * 4 + [(REST, 1.0)],
    "fast": [(REST, 2.0), ("thumbs_up-07", 1.2), ("flex-14", 1.2), ("yawn-19", 1.5), (REST, 2.0)],
    "hard2": [(REST, 2.0), ("cover_eyes-05", 2.5), (REST, 2.0), ("dab-07", 2.5), (REST, 2.0), ("angry-05", 2.5), (REST, 2.0), ("cover_eyes-11", 2.5), (REST, 2.0), ("dab-12", 2.5), (REST, 2.0), ("angry-09", 2.5), (REST, 2.0)],
    "far": [(REST, 2.0), ("thumbs_up-07^", 2.5), (REST, 2.0), ("flex-14^", 2.5), (REST, 2.0), ("yawn-19^", 2.5), (REST, 2.0), ("yawn-02^", 2.5), (REST, 2.0), ("flex-04^", 2.5), (REST, 2.0), ("thumbs_up-11^", 2.5), (REST, 2.0)],
    "mirror": [(REST, 2.0), ("thumbs_up-07~", 2.5), (REST, 2.0), ("flex-14~", 2.5), (REST, 2.0), ("yawn-19~", 2.5), (REST, 2.0), ("cover_eyes-02~", 2.5), (REST, 2.0), ("dab-01~", 2.5), (REST, 2.0)],
    "sweep": [(REST, 2.0), ("flex-01", 2.5), (REST, 2.0), ("thumbs_up-11", 2.5), (REST, 2.0), ("yawn-02", 2.5), (REST, 2.0), ("flex-04", 2.5), (REST, 2.0), ("thumbs_up-13", 2.5), (REST, 2.0), ("yawn-15", 2.5), (REST, 2.0)],
    "hold-yawn": [(REST, 2.0), ("yawn-12", 10.0), (REST, 2.0)],
    "hold-thumb": [(REST, 2.0), ("thumbs_up-11", 10.0), (REST, 2.0)],
    "hold-flex": [(REST, 2.0), ("flex-04", 10.0), (REST, 2.0)],
    # FIX round 2: flex-09 (one arm flexed, the other hand pointing at the bicep, which the hand model reads as a
    # thumbs-up) must play Goblin Muscle; the ground truth is the label, no other emote is accepted (FIX round 3).
    "flex09x3": [(REST, 2.0), ("flex-09", 2.5)] * 3 + [(REST, 1.0)],
}


def frame(path, mirror=False, far=False):
    im = Image.open(path).convert("RGB")
    if mirror:
        im = ImageOps.mirror(im)
    im.thumbnail((W, H))
    if far:
        im = im.resize((int(im.width * 0.55), int(im.height * 0.55)), Image.LANCZOS)
    canvas = Image.new("RGB", (W, H), "white")
    canvas.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    buf = io.BytesIO()
    canvas.save(buf, "JPEG", quality=88)
    return buf.getvalue()


def build(outdir, name):
    segs = CLIPS[name]
    out = os.path.join(outdir, f"e2e-{name}.mjpeg")
    labels = os.path.join(outdir, f"e2e-{name}-labels.json")
    events = []
    t = 0.0
    with open(out, "wb") as f:
        for sid, secs in segs:
            mirror, far = sid.endswith("~"), sid.endswith("^")
            base = sid.rstrip("~^")
            src = json.load(open(os.path.join(STILLS, base + ".json")))["source"]
            jpeg = frame(os.path.join(SRC, src), mirror, far)
            for _ in range(int(round(secs * FPS))):
                f.write(jpeg)
            g = base.rsplit("-", 1)[0]
            if base != REST and g in POS and name not in ("hard", "hard2"):
                events.append({"gesture": g, "still": sid, "startMs": int(t * 1000), "endMs": int((t + secs) * 1000)})
            t += secs
    json.dump(
        {"file": os.path.basename(out), "fps": FPS, "width": W, "height": H, "durationMs": int(t * 1000), "segments": [[s, d] for s, d in segs], "events": events},
        open(labels, "w"),
        indent=1,
    )
    print(out, round(os.path.getsize(out) / 1e6, 1), "MB", t, "s", len(events), "events")


if __name__ == "__main__":
    outdir = sys.argv[1]
    names = sys.argv[2:]
    if names == ["all"]:
        names = list(CLIPS)
    os.makedirs(outdir, exist_ok=True)
    for n in names:
        build(outdir, n)
