from __future__ import annotations

import io
import os
from pathlib import Path
from typing import Optional, Tuple

import librosa
import numpy as np
import soundfile as sf


SUPPORTED_EXTENSIONS = {
    ".wav",
    ".flac",
    ".mp3",
    ".m4a",
    ".ogg",
}


def validate_audio_path(path: str | Path) -> Path:
    path = Path(path)

    if not path.exists():
        raise FileNotFoundError(f"Audio file not found: {path}")

    if path.suffix.lower() not in SUPPORTED_EXTENSIONS:
        raise ValueError(f"Unsupported audio format: {path.suffix}")

    return path


def load_audio(
    source: str | Path | bytes,
    sample_rate: int = 16000,
    mono: bool = True,
    normalize: bool = True,
    dtype=np.float32,
) -> Tuple[np.ndarray, int]:

    if isinstance(source, (str, Path)):
        source = validate_audio_path(source)

        y, sr = librosa.load(
            str(source),
            sr=sample_rate,
            mono=mono,
        )

    elif isinstance(source, bytes):
        with io.BytesIO(source) as audio_buffer:
            y, sr = sf.read(audio_buffer)

        if y.ndim > 1 and mono:
            y = np.mean(y, axis=1)

        if sr != sample_rate:
            y = librosa.resample(
                y.astype(np.float32),
                orig_sr=sr,
                target_sr=sample_rate,
            )
            sr = sample_rate

    else:
        raise TypeError("Unsupported audio source type")

    y = y.astype(dtype)

    if normalize:
        y = normalize_audio(y)

    return y, sr


def normalize_audio(y: np.ndarray) -> np.ndarray:
    if len(y) == 0:
        return y.astype(np.float32)

    max_val = np.max(np.abs(y))

    if max_val < 1e-8:
        return y.astype(np.float32)

    y = y / max_val
    return np.clip(y, -1.0, 1.0).astype(np.float32)


def rms_energy(y: np.ndarray) -> float:
    if len(y) == 0:
        return 0.0

    return float(np.sqrt(np.mean(np.square(y))))


def audio_duration(y: np.ndarray, sr: int) -> float:
    if sr <= 0:
        return 0.0

    return float(len(y) / sr)


def pad_or_trim(
    y: np.ndarray,
    target_length: int,
    random_crop: bool = False,
) -> np.ndarray:

    current_length = len(y)

    if current_length == target_length:
        return y.astype(np.float32)

    if current_length < target_length:
        padding = target_length - current_length
        return np.pad(y, (0, padding)).astype(np.float32)

    # trim
    if random_crop:
        max_start = current_length - target_length
        start = np.random.randint(0, max_start + 1)
        y = y[start:start + target_length]
    else:
        y = y[:target_length]

    return y.astype(np.float32)


def ensure_mono(y: np.ndarray) -> np.ndarray:
    if y.ndim == 1:
        return y.astype(np.float32)

    return np.mean(y, axis=1).astype(np.float32)


def save_audio(
    path: str | Path,
    y: np.ndarray,
    sr: int = 16000,
) -> None:

    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    sf.write(str(path), y, sr)


def chunk_audio(
    y: np.ndarray,
    sr: int,
    chunk_duration: float = 2.0,
    overlap_duration: float = 1.0,
) -> list[np.ndarray]:

    chunk_size = int(sr * chunk_duration)
    overlap_size = int(sr * overlap_duration)

    if overlap_size >= chunk_size:
        raise ValueError("overlap_duration must be smaller than chunk_duration")

    step = chunk_size - overlap_size

    chunks = []

    for start in range(0, len(y), step):
        end = start + chunk_size
        chunk = y[start:end]

        if len(chunk) < chunk_size:
            chunk = pad_or_trim(chunk, chunk_size)

        chunks.append(chunk.astype(np.float32))

        if end >= len(y):
            break

    return chunks