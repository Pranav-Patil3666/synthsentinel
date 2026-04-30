import os
import shutil
import random

# ==============================
# BASE PATH
# ==============================
BASE = r"D:\ml-project\Audio Forensics for Voice Security\ml"

# ==============================
# ASVspoof Paths (UNCHANGED)
# ==============================
asv_base = os.path.join(BASE, "datasets", "asvspoof2019")

train_audio = os.path.join(asv_base, "train", "flac")
dev_audio = os.path.join(asv_base, "dev", "flac")

protocol_dir = os.path.join(asv_base, "protocols")

train_protocol = os.path.join(
    protocol_dir, "ASVspoof2019.LA.cm.train.trn.txt"
)

dev_protocol = os.path.join(
    protocol_dir, "ASVspoof2019.LA.cm.dev.trl.txt"
)

# ==============================
# OUTPUT PATHS
# ==============================
output_real = os.path.join(BASE, "data", "processed", "real", "asvspoof")
output_fake = os.path.join(BASE, "data", "processed", "fake", "asvspoof")

os.makedirs(output_real, exist_ok=True)
os.makedirs(output_fake, exist_ok=True)


# ==============================
# PROCESS FUNCTION (FIXED)
# ==============================
def process_protocol(
    protocol_file,
    audio_dir,
    prefix,
    real_limit=8000,
    fake_limit=8000,
):
    real_count = 0
    fake_count = 0

    with open(protocol_file, "r") as f:
        lines = f.readlines()

    # 🔥 FIX: shuffle lines to remove sequential bias
    random.shuffle(lines)

    for line in lines:
        if real_count >= real_limit and fake_count >= fake_limit:
            break

        parts = line.strip().split()

        if len(parts) < 2:
            continue

        file_id = parts[1]
        label = parts[-1].strip().lower()

        file_name = file_id + ".flac"
        src = os.path.join(audio_dir, file_name)

        if not os.path.exists(src):
            continue

        try:
            if label == "bonafide" and real_count < real_limit:
                dst = os.path.join(
                    output_real,
                    f"{prefix}_real_{real_count}.flac",
                )
                shutil.copy(src, dst)
                real_count += 1

            elif label == "spoof" and fake_count < fake_limit:
                dst = os.path.join(
                    output_fake,
                    f"{prefix}_fake_{fake_count}.flac",
                )
                shutil.copy(src, dst)
                fake_count += 1

        except Exception:
            continue

    print(f"{prefix} → Real: {real_count}, Fake: {fake_count}")


# ==============================
# EXECUTION
# ==============================
print("Processing TRAIN...")
process_protocol(train_protocol, train_audio, prefix="train")

print("Processing DEV...")
process_protocol(dev_protocol, dev_audio, prefix="dev")

print("✅ ASVspoof dataset prepared")