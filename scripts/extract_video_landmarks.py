#!/usr/bin/env python3
"""
Runs the site's own three .task models in VIDEO mode over a fake-camera clip
(scripts/build_e2e_clips.py) and dumps per-frame landmarks. VIDEO mode is what
the page uses, and its pose landmarks jitter frame to frame on a static image
where IMAGE mode (tests/fixtures/stills) is steady; the corpus reported 100 %
while the real pipeline fired the wrong emote (docs/reports/emotes.md round 2,
D1), so the gate needs these too.

  /usr/bin/python3 scripts/extract_video_landmarks.py CLIP.mjpeg LABELS.json OUT.json [--step 3]

Every `step`-th 30 fps frame is sampled (3 = 10 fps). The output holds full
landmarks and is large; `npx vite-node scripts/compact-video-fixture.ts OUT.json
tests/fixtures/video/<name>.json` reduces it to what the engine consumes.
"""
import io
import json
import sys

import mediapipe as mp
import numpy as np
from mediapipe.tasks import python as mpp
from mediapipe.tasks.python import vision
from PIL import Image

import os

HERE = os.path.dirname(os.path.abspath(__file__))
MODELS = os.path.join(os.path.dirname(HERE), "public", "mediapipe", "models")


def main():
    clip, labels_path, out = sys.argv[1], sys.argv[2], sys.argv[3]
    step = int(sys.argv[sys.argv.index("--step") + 1]) if "--step" in sys.argv else 3
    labels = json.load(open(labels_path))
    fps = labels.get("fps", 30)
    data = open(clip, "rb").read()
    frames = []
    i = 0
    while True:
        a = data.find(b"\xff\xd8", i)
        if a < 0:
            break
        b = data.find(b"\xff\xd9", a) + 2
        frames.append(data[a:b])
        i = b
    B = mpp.BaseOptions
    face = vision.FaceLandmarker.create_from_options(vision.FaceLandmarkerOptions(base_options=B(model_asset_path=f"{MODELS}/face_landmarker.task"), running_mode=vision.RunningMode.VIDEO, num_faces=1))
    hands = vision.HandLandmarker.create_from_options(vision.HandLandmarkerOptions(base_options=B(model_asset_path=f"{MODELS}/hand_landmarker.task"), running_mode=vision.RunningMode.VIDEO, num_hands=2))
    pose = vision.PoseLandmarker.create_from_options(vision.PoseLandmarkerOptions(base_options=B(model_asset_path=f"{MODELS}/pose_landmarker_lite.task"), running_mode=vision.RunningMode.VIDEO, num_poses=1))
    pts = lambda lms: [[round(l.x, 5), round(l.y, 5)] for l in lms]
    rows = []
    aspect = 4 / 3
    for k in range(0, len(frames), step):
        im = np.array(Image.open(io.BytesIO(frames[k])).convert("RGB"))
        aspect = im.shape[1] / im.shape[0]
        img = mp.Image(image_format=mp.ImageFormat.SRGB, data=im)
        ts = int(k * 1000 / fps)
        fr = face.detect_for_video(img, ts)
        hr = hands.detect_for_video(img, ts)
        pr = pose.detect_for_video(img, ts)
        rows.append({"ms": ts, "pose": pts(pr.pose_landmarks[0]) if pr.pose_landmarks else None, "hands": [pts(h) for h in hr.hand_landmarks], "face": pts(fr.face_landmarks[0]) if fr.face_landmarks else None})
    json.dump({"clip": labels["file"], "fps": fps / step, "aspect": aspect, "durationMs": labels["durationMs"], "segments": labels.get("segments", []), "events": labels["events"], "frames": rows}, open(out, "w"))
    print(len(frames), "frames,", len(rows), "sampled ->", out)


if __name__ == "__main__":
    main()
