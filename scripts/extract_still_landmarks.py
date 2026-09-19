#!/usr/bin/env python3
"""
Build tests/fixtures/stills/*.json: MediaPipe landmarks for every labelled still
in the (read-only, uncommitted) gesture image corpus, using the SAME .task
models the site ships in public/mediapipe/models.

The source images are stock-photo screenshots (Getty watermarks) collected for
the Python project, so they are never committed: only the landmark geometry
(normalised x, y per point) and a sha256 of each source file are written.

Usage (needs a Python with `mediapipe` >= 0.10, the macOS system python3 has 0.10.20):
  /usr/bin/python3 scripts/extract_still_landmarks.py [--src DIR] [--out DIR]

Labels: the folder name. Positives for this site: flex, thumbs_up, yawn.
Negatives (must NOT fire anything): angry, cover_eyes, dab.
"""
import argparse
import hashlib
import json
import os
import sys
import time

import mediapipe as mp
from mediapipe.tasks import python as mp_python
from mediapipe.tasks.python import vision

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
MODELS = os.path.join(REPO, "public", "mediapipe", "models")
DEFAULT_SRC = os.path.expanduser(
    "~/Desktop/Out and About/Sidequest/Clash Royale Emote Bot/data/raw/gestures"
)
LABELS = ["flex", "thumbs_up", "yawn", "angry", "cover_eyes", "dab"]
POSITIVE = {"flex", "thumbs_up", "yawn"}


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def pts(landmarks, with_vis=False):
    out = []
    for lm in landmarks:
        p = [round(lm.x, 5), round(lm.y, 5)]
        out.append(p)
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--src", default=DEFAULT_SRC)
    ap.add_argument("--out", default=os.path.join(REPO, "tests", "fixtures", "stills"))
    args = ap.parse_args()

    base = mp_python.BaseOptions
    face = vision.FaceLandmarker.create_from_options(
        vision.FaceLandmarkerOptions(
            base_options=base(model_asset_path=os.path.join(MODELS, "face_landmarker.task")),
            running_mode=vision.RunningMode.IMAGE,
            num_faces=1,
        )
    )
    hands = vision.HandLandmarker.create_from_options(
        vision.HandLandmarkerOptions(
            base_options=base(model_asset_path=os.path.join(MODELS, "hand_landmarker.task")),
            running_mode=vision.RunningMode.IMAGE,
            num_hands=2,
        )
    )
    pose = vision.PoseLandmarker.create_from_options(
        vision.PoseLandmarkerOptions(
            base_options=base(model_asset_path=os.path.join(MODELS, "pose_landmarker_lite.task")),
            running_mode=vision.RunningMode.IMAGE,
            num_poses=1,
        )
    )

    os.makedirs(args.out, exist_ok=True)
    index = []
    for label in LABELS:
        folder = os.path.join(args.src, label)
        if not os.path.isdir(folder):
            continue
        files = sorted(f for f in os.listdir(folder) if f.lower().endswith((".png", ".jpg", ".jpeg")))
        for i, name in enumerate(files, 1):
            path = os.path.join(folder, name)
            img = mp.Image.create_from_file(path)
            w, h = img.width, img.height
            fr = face.detect(img)
            hr = hands.detect(img)
            pr = pose.detect(img)
            rec = {
                "id": f"{label}-{i:02d}",
                "label": label,
                "expected": label if label in POSITIVE else None,
                "source": os.path.relpath(path, args.src),
                "sha256": sha256(path),
                "width": w,
                "height": h,
                "aspect": round(w / h, 5),
                "pose": pts(pr.pose_landmarks[0]) if pr.pose_landmarks else None,
                "hands": [pts(hl) for hl in hr.hand_landmarks],
                "handedness": [c[0].category_name for c in hr.handedness],
                "face": pts(fr.face_landmarks[0]) if fr.face_landmarks else None,
            }
            with open(os.path.join(args.out, rec["id"] + ".json"), "w") as f:
                json.dump(rec, f, separators=(",", ":"))
            index.append(
                {
                    "id": rec["id"],
                    "label": label,
                    "expected": rec["expected"],
                    "pose": rec["pose"] is not None,
                    "hands": len(rec["hands"]),
                    "face": rec["face"] is not None,
                }
            )
            print(
                f"{rec['id']:14s} {w}x{h}  pose={'Y' if rec['pose'] else '-'} "
                f"hands={len(rec['hands'])} face={'Y' if rec['face'] else '-'}",
                file=sys.stderr,
            )
    labels_path = os.path.join(args.out, "labels.json")
    labels = json.load(open(labels_path)) if os.path.exists(labels_path) else {}
    kinds = {}
    for k in labels.get("_about", "").split("Kinds: ")[-1].split("; "):
        if ": " in k:
            name, desc = k.split(": ", 1)
            kinds[name] = desc
    for s in index:
        lab = labels.get(s["id"], {"kind": "ok" if s["expected"] else "hard", "note": ""})
        s["kind"] = lab["kind"]
        s["note"] = lab["note"]
        if lab["kind"] == "skip":
            s["expected"] = None
    meta = {
        "generated": time.strftime("%Y-%m-%d"),
        "generator": "scripts/extract_still_landmarks.py (mediapipe %s, IMAGE mode, models from public/mediapipe/models)"
        % mp.__version__,
        "source": "stock-photo screenshots in the Python project's data/raw/gestures/ (not committed: copyrighted)",
        "positives": sorted(POSITIVE),
        "negatives": [l for l in LABELS if l not in POSITIVE],
        "kinds": kinds,
        "stills": index,
    }
    with open(os.path.join(args.out, "index.json"), "w") as f:
        json.dump(meta, f, indent=1)
    print(f"wrote {len(index)} stills to {args.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
