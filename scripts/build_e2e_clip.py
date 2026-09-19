#!/usr/bin/env python3
"""
Builds the real-video end-to-end clip that Chrome's fake camera plays into the
page (scripts/e2e-camera.mjs): a slideshow of real photos from the read-only,
uncommitted gesture corpus, 640x480 letterboxed, 30 fps MJPEG (an .mjpeg file
is simply concatenated JPEG frames, which is what Chrome's
--use-file-for-fake-video-capture reads). Needs only Pillow.

Output tests/fixtures/clips/e2e-three-gestures.mjpeg is git-ignored (stock
photos); the ground truth tests/fixtures/clips/e2e-labels.json is committed.

  python3 scripts/build_e2e_clip.py [--src DIR]
"""
import argparse
import io
import json
import os

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
STILLS = os.path.join(REPO, "tests", "fixtures", "stills")
OUT = os.path.join(REPO, "tests", "fixtures", "clips", "e2e-three-gestures.mjpeg")
LABELS = os.path.join(REPO, "tests", "fixtures", "clips", "e2e-labels.json")
DEFAULT_SRC = os.path.expanduser("~/Desktop/Out and About/Sidequest/Clash Royale Emote Bot/data/raw/gestures")
FPS = 30  # Chrome plays an .mjpeg fake-camera file at 30 fps regardless of what it was built at
W, H = 640, 480
REST = "angry-04"
# (still id, seconds); the gesture stills are the same ones the clip scripts use for "sequence-three".
SEGMENTS = [(REST, 2.0), ("thumbs_up-07", 2.5), (REST, 2.0), ("flex-14", 2.5), (REST, 2.0), ("yawn-19", 2.5), (REST, 2.0)]


def frame_jpeg(path):
    im = Image.open(path).convert("RGB")
    im.thumbnail((W, H))
    canvas = Image.new("RGB", (W, H), "white")
    canvas.paste(im, ((W - im.width) // 2, (H - im.height) // 2))
    buf = io.BytesIO()
    canvas.save(buf, "JPEG", quality=88)
    return buf.getvalue()


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=DEFAULT_SRC)
    args = ap.parse_args()
    events, t = [], 0.0
    with open(OUT, "wb") as out:
        for sid, secs in SEGMENTS:
            src = json.load(open(os.path.join(STILLS, sid + ".json")))["source"]
            jpeg = frame_jpeg(os.path.join(args.src, src))
            for _ in range(int(round(secs * FPS))):
                out.write(jpeg)
            if sid != REST:
                events.append({"gesture": sid.rsplit("-", 1)[0], "still": sid, "startMs": int(t * 1000), "endMs": int((t + secs) * 1000)})
            t += secs
    json.dump(
        {
            "_about": "Ground truth for tests/fixtures/clips/e2e-three-gestures.mjpeg (git-ignored; rebuild with scripts/build_e2e_clip.py). Play it through Chrome's fake camera with scripts/e2e-camera.mjs: every event must fire its emote once within 1000 ms of startMs and nothing else may fire.",
            "file": os.path.basename(OUT),
            "fps": FPS,
            "width": W,
            "height": H,
            "durationMs": int(t * 1000),
            "rest": f"{REST} (a man staring at the camera, no hands)",
            "events": events,
        },
        open(LABELS, "w"),
        indent=1,
    )
    print(f"{OUT}: {os.path.getsize(OUT) / 1e6:.1f} MB, {t:.1f} s at {FPS} fps; {len(events)} events -> {LABELS}")


if __name__ == "__main__":
    main()
