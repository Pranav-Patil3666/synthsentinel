import os
import sys
import json
import argparse
from pathlib import Path

import torch
import librosa
import numpy as np

from transformers import (
    Wav2Vec2FeatureExtractor,
    Wav2Vec2ForSequenceClassification,
)

CURRENT_DIR = Path(__file__).resolve().parent
ML_ROOT    = CURRENT_DIR.parent
MODEL_DIR  = ML_ROOT / "models" / "wav2vec2_base" / "best"

# =========================================
# CONFIG — must match wav2vec_train.py
# =========================================
SAMPLE_RATE      = 16000
MAX_DURATION     = 2        # fixed — matches training
MAX_LENGTH       = SAMPLE_RATE * MAX_DURATION
DEFAULT_THRESHOLD = 0.63

device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
print(f"Using device: {device}")

print("🔄 Loading feature extractor...")
processor = Wav2Vec2FeatureExtractor.from_pretrained(str(MODEL_DIR))

print("🧠 Loading model...")
model = Wav2Vec2ForSequenceClassification.from_pretrained(str(MODEL_DIR))
model.to(device)    #type: ignore
model.eval() #type: ignore
print("✅ Model loaded")


def load_audio(audio_path: str) -> np.ndarray:
    y, _ = librosa.load(audio_path, sr=SAMPLE_RATE, mono=True)

    if len(y) < MAX_LENGTH:
        y = np.pad(y, (0, MAX_LENGTH - len(y)))
    else:
        y = y[:MAX_LENGTH]

    return y


def predict(audio_path: str, threshold: float = DEFAULT_THRESHOLD) -> dict:
    if not os.path.exists(audio_path):
        raise FileNotFoundError(f"Audio file not found: {audio_path}")

    waveform = load_audio(audio_path)

    inputs = processor(
        waveform,
        sampling_rate=SAMPLE_RATE,
        return_tensors="pt",
        padding=False
    )

    input_values = inputs.input_values.to(device)

    with torch.no_grad():
        outputs = model(input_values=input_values)   #type: ignore
        probs   = torch.softmax(outputs.logits, dim=1)

    real_prob = probs[0][0].item()
    fake_prob = probs[0][1].item()

    label      = "FAKE" if fake_prob >= threshold else "REAL"
    confidence = fake_prob if label == "FAKE" else real_prob

    # consistent risk bucketing across entire system
    if fake_prob >= 0.75:
        risk = "HIGH"
    elif fake_prob >= 0.50:
        risk = "MEDIUM"
    else:
        risk = "LOW"

    return {
        "file"     : str(audio_path),
        "label"    : label,
        "confidence": round(confidence, 4),
        "real_prob": round(real_prob, 4),
        "fake_prob": round(fake_prob, 4),
        "threshold": threshold,
        "risk"     : risk,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--audio",     type=str,   required=True)
    parser.add_argument("--threshold", type=float, default=DEFAULT_THRESHOLD)
    args = parser.parse_args()

    result = predict(args.audio, args.threshold)

    print("\n==============================")
    print("WAV2VEC2 INFERENCE RESULT")
    print("==============================")
    print(json.dumps(result, indent=4))


if __name__ == "__main__":
    main()