#!/usr/bin/env python3
"""
Writes tests/fixtures/clips/clips.json: the ground-truth CLIP SCRIPTS the
engine is measured against (tests/clips.test.ts, scripts/eval-corpus.ts).

A clip is not stored frame by frame (a 4 s clip with a 478-point face would be
~500 KB); it is a list of segments, each holding one real still from
tests/fixtures/stills for N ms, with a linear transition from the previous
segment and seeded jitter. tests/clips.ts turns a script into 25 fps frames
deterministically, so every run sees the same landmarks.

Ground truth per clip: `events` = [{gesture, startMs, endMs}] where startMs is
the moment the gesture still is fully reached (transition finished) and endMs
the moment it starts to leave. `expectFires` is the exact list of emotes the
clip must fire, in order. Consumer bar (docs/reports/emotes-spec.md, S3-S5):
each expected fire happens within 1000 ms of its event's startMs, nothing else
fires, and a neutral minute fires nothing.

Run: python3 scripts/build_clip_scripts.py  (no dependencies)
"""
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
STILLS = os.path.join(REPO, "tests", "fixtures", "stills")
OUT = os.path.join(REPO, "tests", "fixtures", "clips", "clips.json")

FPS = 25
JITTER = 0.004  # sigma of per-frame landmark tremor in normalised units (~2-3 px at 640x480)
TRANSITION = 300
# Rest frames: negatives that look like a person sitting still (see labels.json "rest frame").
REST = ["angry-04", "angry-08", "angry-03", "angry-12"]
# Hands-visible rest frames (fists / hands at a desk), for the neutral minute.
REST_HANDS = ["angry-07", "angry-09", "angry-10", "angry-02"]

index = json.load(open(os.path.join(STILLS, "index.json")))
stills = {s["id"]: s for s in index["stills"]}
aspect = {s: json.load(open(os.path.join(STILLS, s + ".json")))["aspect"] for s in stills}

clips = []
seed = 1


def clip(cid, segments, events, expect, kind, note="", extra=None):
    global seed
    c = {
        "id": cid,
        "kind": kind,
        "fps": FPS,
        "jitter": JITTER,
        "seed": seed,
        "aspect": extra["aspect"] if extra and "aspect" in extra else aspect[segments[1]["still"]] if len(segments) > 1 else 1.33,
        "segments": segments,
        "events": events,
        "expectFires": expect,
        "note": note,
    }
    if extra:
        c.update({k: v for k, v in extra.items() if k != "aspect"})
    clips.append(c)
    seed += 1


def hold(still, ms, transition=TRANSITION):
    return {"still": still, "ms": ms, "transitionMs": transition}


# 1. One clip per positive still: rest 1.5 s -> gesture 2 s -> rest 1.5 s.
i = 0
for s in index["stills"]:
    if s["label"] not in ("flex", "thumbs_up", "yawn") or s["kind"] == "skip":
        continue
    rest = REST[i % len(REST)]
    i += 1
    g = s["label"]
    segs = [hold(rest, 1500, 0), hold(s["id"], 2000), hold(rest, 1500)]
    start = 1500 + TRANSITION
    end = 1500 + 2000
    events = [{"gesture": g, "startMs": start, "endMs": end}]
    if s["kind"] == "ok":
        clip("single-" + s["id"], segs, events, [g], "positive", s["note"])
    elif s["kind"] == "occluded":
        clip("single-" + s["id"], segs, events, [], "occluded", s["note"] + " (a yawn fire is also accepted; any other emote is a false trigger)", {"acceptFires": [g]})
    else:  # partial
        clip("single-" + s["id"], segs, events, [g], "partial", s["note"])

# 2. Repeats: the same gesture three times with rests (hysteresis must not swallow repeats).
# thumbs_up-14 replaced thumbs_up-05 in FIX round 1: -05 was relabelled partial (garbage hand landmarks).
for g, sid in (("flex", "flex-02"), ("thumbs_up", "thumbs_up-14"), ("yawn", "yawn-12")):
    segs = [hold("angry-04", 1200, 0)]
    events = []
    t = 1200
    for _ in range(3):
        segs.append(hold(sid, 1500))
        events.append({"gesture": g, "startMs": t + TRANSITION, "endMs": t + 1500})
        t += 1500
        segs.append(hold("angry-04", 1500))
        t += 1500
    clip("repeat-" + g, segs, events, [g, g, g], "positive", "three holds of the same gesture, 1.2 s rests")

# 2b. Holds (FIX round 1, D4): one gesture held for 10 s must fire exactly once, at a laptop's
# 25 fps and at a phone's 12 and 8 fps, with the corpus jitter and with twice the jitter.
for g, sid, jitter in (("thumbs_up", "thumbs_up-07", JITTER), ("flex", "flex-14", JITTER), ("yawn", "yawn-12", JITTER), ("yawn", "yawn-19", 2 * JITTER)):
    for fps in (25, 12, 8):
        segs = [hold("angry-04", 1500, 0), hold(sid, 10000), hold("angry-04", 1500)]
        events = [{"gesture": g, "startMs": 1500 + TRANSITION, "endMs": 11500}]
        clip(f"hold-{sid}-{fps}fps" + ("-jitter2" if jitter != JITTER else ""), segs, events, [g], "positive",
             f"{sid} held for 10 s at {fps} fps, jitter {jitter}: fires once, never re-fires while held",
             {"fps": fps, "jitter": jitter})

# 3. Sequence: thumbs-up -> flex -> yawn in one take.
segs = [hold("angry-08", 1000, 0)]
events, t = [], 1000
for g, sid in (("thumbs_up", "thumbs_up-07"), ("flex", "flex-14"), ("yawn", "yawn-19")):
    segs.append(hold(sid, 1800))
    events.append({"gesture": g, "startMs": t + TRANSITION, "endMs": t + 1800})
    t += 1800
    segs.append(hold("angry-08", 1200))
    t += 1200
clip("sequence-three", segs, events, ["thumbs_up", "flex", "yawn"], "positive", "all three gestures in one take")

# 4. Neutral minute: rest frames, hands visible at rest, talking and looking around. Must fire nothing.
segs = [hold("angry-04", 3000, 0)]
t = 3000
plan = [
    ("angry-08", 3000, {}), ("angry-03", 3000, {}), ("angry-07", 2500, {}), ("angry-12", 3000, {}),
    ("angry-09", 2500, {}), ("angry-04", 4000, {"talk": True}), ("angry-10", 3000, {}),
    ("angry-08", 4000, {"look": True}), ("angry-02", 2500, {}), ("angry-11", 3000, {"talk": True}),
    ("angry-03", 3000, {"look": True}), ("angry-04", 3000, {}), ("angry-12", 4000, {"talk": True}),
    ("angry-07", 3000, {"look": True}), ("angry-08", 3000, {}), ("angry-09", 3000, {"talk": True}),
    ("angry-04", 3000, {"look": True}), ("angry-03", 3000, {}),
]
for sid, ms, fx in plan:
    seg = hold(sid, ms)
    seg.update(fx)
    segs.append(seg)
    t += ms
clip("neutral-60s", segs, [], [], "neutral", f"{t/1000:.1f} s of a person at rest, talking (mouth modulated, eyes open) and looking around; zero emotes allowed", {"aspect": 1.5})

# 5. Hard-negative minute: cover-eyes, dab and screams, each from rest.
segs = [hold("angry-04", 1000, 0)]
t = 1000
hard = [s["id"] for s in index["stills"] if s["kind"] == "hard"]
for k, sid in enumerate(hard):
    segs.append(hold(sid, 1500))
    t += 1500
    if k % 3 == 2:
        segs.append(hold(REST[k % len(REST)], 800))
        t += 800
clip("hard-negatives-60s", segs, [], [], "hard", f"{t/1000:.1f} s: {len(hard)} hard negatives (15 cover-eyes, 15 dab, 3 screams) with rests; at most one wrong emote allowed", {"aspect": 1.5})

meta = {
    "_about": __doc__.strip().splitlines()[0],
    "fps": FPS,
    "jitter": JITTER,
    "transitionMs": TRANSITION,
    "kinds": {
        "positive": "expectFires must match exactly, each within 1000 ms of its event startMs (gated)",
        "partial": "the landmarkers cannot see the gesture (arm-only crop, no face mesh): a miss is tolerated, any other emote is a false trigger (gated)",
        "occluded": "yawn with a hand over the mouth: only acceptFires may fire (gated: no wrong emote)",
        "neutral": "must fire nothing (gated: 0 in the whole clip, i.e. < 1 per minute)",
        "hard": "should fire nothing; gated at <= 1 firing in the whole clip",
    },
    "clips": clips,
}
json.dump(meta, open(OUT, "w"), indent=1)
from collections import Counter
print(len(clips), "clips", Counter(c["kind"] for c in clips))
