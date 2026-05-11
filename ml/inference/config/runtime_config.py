from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from ._base import env_bool, env_float, env_int


@dataclass(slots=True)
class RuntimeConfig:
    sample_rate: int = env_int("SATARKRAHE_SAMPLE_RATE", 16000)

    cnn_chunk_duration_sec: float = env_float("SATARKRAHE_CNN_CHUNK_DURATION_SEC", 2.0)
    cnn_chunk_overlap_sec: float = env_float("SATARKRAHE_CNN_CHUNK_OVERLAP_SEC", 1.0)

    wav2vec2_duration_sec: float = env_float("SATARKRAHE_WAV2VEC2_DURATION_SEC", 4.0)

    vad_aggressiveness: int = env_int("SATARKRAHE_VAD_AGGRESSIVENESS", 2)
    vad_frame_ms: int = env_int("SATARKRAHE_VAD_FRAME_MS", 30)

    min_audio_duration_sec: float = env_float("SATARKRAHE_MIN_AUDIO_DURATION_SEC", 0.25)
    max_audio_duration_sec: float = env_float("SATARKRAHE_MAX_AUDIO_DURATION_SEC", 60.0)

    enable_waveform_augmentation: bool = env_bool("SATARKRAHE_ENABLE_WAVEFORM_AUGMENTATION", False)
    prefer_cuda: bool = env_bool("SATARKRAHE_PREFER_CUDA", True)

    websocket_timeout_sec: int = env_int("SATARKRAHE_WEBSOCKET_TIMEOUT_SEC", 120)
    max_session_chunks: int = env_int("SATARKRAHE_MAX_SESSION_CHUNKS", 500)

    def __post_init__(self) -> None:
        self.sample_rate = max(8000, int(self.sample_rate))
        self.cnn_chunk_duration_sec = max(0.5, float(self.cnn_chunk_duration_sec))
        self.cnn_chunk_overlap_sec = max(0.0, float(self.cnn_chunk_overlap_sec))
        if self.cnn_chunk_overlap_sec >= self.cnn_chunk_duration_sec:
            self.cnn_chunk_overlap_sec = max(0.0, self.cnn_chunk_duration_sec - 0.1)

        self.wav2vec2_duration_sec = max(1.0, float(self.wav2vec2_duration_sec))
        self.vad_aggressiveness = min(3, max(0, int(self.vad_aggressiveness)))
        self.vad_frame_ms = int(self.vad_frame_ms)
        self.min_audio_duration_sec = max(0.0, float(self.min_audio_duration_sec))
        self.max_audio_duration_sec = max(self.min_audio_duration_sec, float(self.max_audio_duration_sec))
        self.websocket_timeout_sec = max(1, int(self.websocket_timeout_sec))
        self.max_session_chunks = max(1, int(self.max_session_chunks))

    @property
    def cnn_chunk_step_sec(self) -> float:
        return self.cnn_chunk_duration_sec - self.cnn_chunk_overlap_sec

    def to_dict(self) -> Dict[str, int | float | bool]:
        return {
            "sample_rate": self.sample_rate,
            "cnn_chunk_duration_sec": self.cnn_chunk_duration_sec,
            "cnn_chunk_overlap_sec": self.cnn_chunk_overlap_sec,
            "cnn_chunk_step_sec": self.cnn_chunk_step_sec,
            "wav2vec2_duration_sec": self.wav2vec2_duration_sec,
            "vad_aggressiveness": self.vad_aggressiveness,
            "vad_frame_ms": self.vad_frame_ms,
            "min_audio_duration_sec": self.min_audio_duration_sec,
            "max_audio_duration_sec": self.max_audio_duration_sec,
            "enable_waveform_augmentation": self.enable_waveform_augmentation,
            "prefer_cuda": self.prefer_cuda,
            "websocket_timeout_sec": self.websocket_timeout_sec,
            "max_session_chunks": self.max_session_chunks,
        }


RUNTIME = RuntimeConfig()