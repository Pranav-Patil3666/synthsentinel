from __future__ import annotations

from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, Optional

from .base_schema import clamp_probability, enum_value, normalize_string, to_serializable, utc_now_iso


class AudioLabel(str, Enum):
    REAL = "REAL"
    FAKE = "FAKE"
    UNKNOWN = "UNKNOWN"


class RiskLevel(str, Enum):
    LOW = "LOW"
    MEDIUM = "MEDIUM"
    HIGH = "HIGH"
    UNKNOWN = "UNKNOWN"


class DetectorName(str, Enum):
    CNN = "cnn"
    WAV2VEC2 = "wav2vec2"
    RULES = "rules"
    ENSEMBLE = "ensemble"


@dataclass(slots=True)
class PredictionResult:
    detector: str
    label: AudioLabel | str
    confidence: float
    real_prob: float
    fake_prob: float
    threshold: float = 0.5
    risk: RiskLevel | str = RiskLevel.UNKNOWN
    skip: bool = False

    model_name: str = ""
    model_version: str = ""
    sample_rate: int = 16000
    duration_sec: Optional[float] = None
    chunk_index: Optional[int] = None
    chunk_path: Optional[str] = None
    latency_ms: Optional[float] = None

    timestamp_utc: str = field(default_factory=utc_now_iso)
    meta: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.detector = normalize_string(self.detector, "unknown")
        self.model_name = normalize_string(self.model_name, self.detector)
        self.model_version = normalize_string(self.model_version, "v1")
        self.chunk_path = normalize_string(self.chunk_path, "") or None

        self.label = AudioLabel(enum_value(self.label)) if not isinstance(self.label, AudioLabel) else self.label
        self.risk = RiskLevel(enum_value(self.risk)) if not isinstance(self.risk, RiskLevel) else self.risk

        self.confidence = clamp_probability(self.confidence, default=max(self.real_prob, self.fake_prob))
        self.real_prob = clamp_probability(self.real_prob, default=0.0)
        self.fake_prob = clamp_probability(self.fake_prob, default=0.0)
        self.threshold = clamp_probability(self.threshold, default=0.5)

        if self.skip:
            self.label = AudioLabel.UNKNOWN
            self.risk = RiskLevel.UNKNOWN

    @property
    def probability_gap(self) -> float:
        return self.fake_prob - self.real_prob

    @property
    def winner(self) -> str:
        return "FAKE" if self.fake_prob >= self.real_prob else "REAL"

    def to_dict(self) -> Dict[str, Any]:
        return to_serializable(self)