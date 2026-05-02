import os
import random
import subprocess
import torch
from TTS.api import TTS

# ==============================
# BASE PATH
# ==============================
BASE = r"D:\ml-project\Audio Forensics for Voice Security\ml"

# ==============================
# PATHS
# ==============================
output_dir = os.path.join(BASE, "data", "processed", "fake", "tts")
text_file = os.path.join(BASE, "scripts", "tts_texts.txt")
speaker_dir = os.path.join(BASE, "data", "tts_speakers")

os.makedirs(output_dir, exist_ok=True)

# ==============================
# CONFIG
# ==============================
TARGET = 4000
SAMPLE_RATE = 16000
random.seed(42)

# ==============================
# LOAD TEXTS
# ==============================
print("📄 Loading text corpus...")
with open(text_file, "r", encoding="utf-8") as f:
    texts = [line.strip() for line in f if line.strip()]

print(f"✅ Loaded {len(texts)} text samples")

# ==============================
# LOAD SPEAKERS (CRITICAL FIX)
# ==============================
speaker_files = [
    os.path.join(speaker_dir, f)
    for f in os.listdir(speaker_dir)
    if f.lower().endswith(".wav")
]

if len(speaker_files) == 0:
    raise ValueError("❌ No speaker wav files found!")

print(f"🎤 Loaded {len(speaker_files)} speaker references")

# ==============================
# LOAD MODEL
# ==============================
print("🔄 Loading XTTS v2...")
tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2")

device = "cuda" if torch.cuda.is_available() else "cpu"
tts.to(device)

print("✅ Model loaded on device:", device)

# ==============================
# TEXT VARIATION
# ==============================
def vary_text(text):
    if random.random() < 0.3:
        text = text.lower()
    if random.random() < 0.2:
        text += " please"
    if random.random() < 0.2:
        text = text.replace(" ", "  ")
    if random.random() < 0.1:
        text += " now"
    return text

# ==============================
# GENERATION LOOP
# ==============================
count = 0

print("🚀 Generating XTTS dataset...")

while count < TARGET:
    try:
        text = vary_text(random.choice(texts))
        speaker_wav = random.choice(speaker_files)

        temp_path = os.path.join(output_dir, f"temp_{count}.wav")
        final_path = os.path.join(output_dir, f"tts_{count}.wav")

        # =========================
        # GENERATE (FIXED)
        # =========================
        tts.tts_to_file(
            text=text,
            speaker_wav=speaker_wav,
            language="en",   # keep stable for now
            file_path=temp_path
        )

        # =========================
        # NORMALIZE
        # =========================
        subprocess.run([
            "ffmpeg", "-loglevel", "error", "-y",
            "-i", temp_path,
            "-ar", str(SAMPLE_RATE),
            "-ac", "1",
            final_path
        ])

        if os.path.exists(final_path):
            os.remove(temp_path)
            count += 1

        if count % 200 == 0:
            print(f"Generated: {count}")

    except Exception as e:
        print(f"⚠️ Skipping: {e}")
        continue

print(f"✅ Generated {count} XTTS samples")