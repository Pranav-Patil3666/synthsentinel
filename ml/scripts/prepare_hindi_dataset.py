import os
import shutil
import pandas as pd
import random
import subprocess
from pathlib import Path

# ==============================
# BASE PATH
# ==============================
BASE = r"D:\ml-project\Audio Forensics for Voice Security\ml"

# ==============================
# INPUT PATHS (UNCHANGED)
# ==============================
hindi_root = os.path.join(
    BASE,
    "datasets",
    "mozilla hindi",
    "cv-corpus-25.0-2026-03-09",
    "hi"
)

tsv_path = os.path.join(hindi_root, "validated.tsv")
clips_path = os.path.join(hindi_root, "clips")

# ==============================
# OUTPUT PATH (FIXED)
# ==============================
output_dir = os.path.join(BASE, "data", "processed", "real", "common_voice")
os.makedirs(output_dir, exist_ok=True)

# ==============================
# CONFIG
# ==============================
TARGET_SAMPLES = 8000
RANDOM_SEED = 42

print("📄 Reading dataset...")
df = pd.read_csv(tsv_path, sep="\t")

# 🔥 Clean invalid rows
df = df.dropna(subset=["path"])

# 🔥 Reproducible randomness
random.seed(RANDOM_SEED)

sample_size = min(TARGET_SAMPLES, len(df))
subset = df.sample(n=sample_size, random_state=RANDOM_SEED)

print(f"🎯 Selected {sample_size} samples")

count = 0

for row in subset.itertuples(index=False):
    src = os.path.join(clips_path, row.path)

    if not os.path.exists(src):
        continue

    # 🔥 Ensure WAV output
    dst = os.path.join(output_dir, f"{count}.wav")

    try:
        # Convert to wav (important for consistency)
        cmd = [
            "ffmpeg",
            "-loglevel", "error",
            "-y",
            "-i", src,
            "-ar", "16000",
            "-ac", "1",
            dst
        ]
        subprocess.run(cmd)

        if os.path.exists(dst):
            count += 1

    except Exception:
        continue

print(f"✅ Copied & converted {count} Hindi samples")