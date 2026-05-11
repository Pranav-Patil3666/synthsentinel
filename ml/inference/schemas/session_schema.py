from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .base_schema import clamp_probability, enum_value, normalize_string, to_serializable, utc_now_iso
from .prediction_schema import AudioLabel, RiskLevel
from .ensemble_schema import FusionResult


@dataclass(slots=True)
class ChunkObservation:
    chunk_index: int
    fake_prob: float
    real_prob: float
    confidence: float
    label: AudioLabel | str
    risk: RiskLevel | str = RiskLevel.UNKNOWN
    detector: str = ""
    skipped: bool = False
    timestamp_utc: str = field(default_factory=utc_now_iso)
    meta: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.chunk_index = int(self.chunk_index)
        self.detector = normalize_string(self.detector, "unknown")
        self.label = AudioLabel(enum_value(self.label)) if not isinstance(self.label, AudioLabel) else self.label
        self.risk = RiskLevel(enum_value(self.risk)) if not isinstance(self.risk, RiskLevel) else self.risk
        self.fake_prob = clamp_probability(self.fake_prob)
        self.real_prob = clamp_probability(self.real_prob)
        self.confidence = clamp_probability(self.confidence, default=max(self.fake_prob, self.real_prob))

    def to_dict(self) -> Dict[str, Any]:
        return to_serializable(self)


@dataclass(slots=True)
class SessionState:
    session_id: str
    call_id: str = ""
    created_at_utc: str = field(default_factory=utc_now_iso)
    updated_at_utc: str = field(default_factory=utc_now_iso)

    chunk_history: List[ChunkObservation] = field(default_factory=list)
    fused_history: List[FusionResult] = field(default_factory=list)

    fake_probs: List[float] = field(default_factory=list)
    real_probs: List[float] = field(default_factory=list)
    risks: List[str] = field(default_factory=list)

    smoothed_fake_prob: float = 0.0
    smoothed_real_prob: float = 0.0
    peak_fake_prob: float = 0.0
    min_fake_prob: float = 1.0

    fake_streak: int = 0
    real_streak: int = 0
    medium_streak: int = 0
    high_streak: int = 0

    last_label: AudioLabel | str = AudioLabel.UNKNOWN
    last_risk: RiskLevel | str = RiskLevel.UNKNOWN
    rolling_window: int = 5

    total_chunks: int = 0
    skipped_chunks: int = 0

    meta: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.session_id = normalize_string(self.session_id, "unknown_session")
        self.call_id = normalize_string(self.call_id, "")
        self.last_label = AudioLabel(enum_value(self.last_label)) if not isinstance(self.last_label, AudioLabel) else self.last_label
        self.last_risk = RiskLevel(enum_value(self.last_risk)) if not isinstance(self.last_risk, RiskLevel) else self.last_risk
        self.rolling_window = max(1, int(self.rolling_window))

    def add_chunk(self, obs: ChunkObservation) -> None:
        self.chunk_history.append(obs)
        self.fake_probs.append(obs.fake_prob)
        self.real_probs.append(obs.real_prob)
        self.risks.append(enum_value(obs.risk))

        self.total_chunks += 1
        if obs.skipped:
            self.skipped_chunks += 1

        self.peak_fake_prob = max(self.peak_fake_prob, obs.fake_prob)
        self.min_fake_prob = min(self.min_fake_prob, obs.fake_prob)

        alpha = 0.6
        if len(self.fake_probs) == 1:
            self.smoothed_fake_prob = obs.fake_prob
            self.smoothed_real_prob = obs.real_prob
        else:
            self.smoothed_fake_prob = alpha * obs.fake_prob + (1 - alpha) * self.smoothed_fake_prob
            self.smoothed_real_prob = alpha * obs.real_prob + (1 - alpha) * self.smoothed_real_prob

        if obs.label == AudioLabel.FAKE:
            self.fake_streak += 1
            self.real_streak = 0
        elif obs.label == AudioLabel.REAL:
            self.real_streak += 1
            self.fake_streak = 0

        if obs.risk == RiskLevel.HIGH:
            self.high_streak += 1
            self.medium_streak = 0
        elif obs.risk == RiskLevel.MEDIUM:
            self.medium_streak += 1
            self.high_streak = 0
        else:
            self.medium_streak = 0
            self.high_streak = 0

        self.last_label = obs.label
        self.last_risk = obs.risk
        self.updated_at_utc = utc_now_iso()

    def add_fused(self, fused: FusionResult) -> None:
        self.fused_history.append(fused)
        self.updated_at_utc = utc_now_iso()

    def recent_chunks(self, n: int = 5) -> List[ChunkObservation]:
        n = max(1, int(n))
        return self.chunk_history[-n:]

    def recent_fake_probs(self, n: int = 5) -> List[float]:
        n = max(1, int(n))
        return self.fake_probs[-n:]

    def to_dict(self) -> Dict[str, Any]:
        return to_serializable(self)


@dataclass(slots=True)
class SessionSummary:
    session_id: str
    call_id: str = ""
    total_chunks: int = 0
    processed_chunks: int = 0
    skipped_chunks: int = 0

    real_votes: int = 0
    fake_votes: int = 0
    medium_risk_votes: int = 0
    high_risk_votes: int = 0

    final_label: AudioLabel | str = AudioLabel.UNKNOWN
    final_risk: RiskLevel | str = RiskLevel.UNKNOWN

    avg_fake_prob: float = 0.0
    max_fake_prob: float = 0.0
    min_fake_prob: float = 0.0
    smoothed_fake_prob: float = 0.0

    start_time_utc: str = field(default_factory=utc_now_iso)
    end_time_utc: Optional[str] = None
    duration_sec: Optional[float] = None

    meta: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.session_id = normalize_string(self.session_id, "unknown_session")
        self.call_id = normalize_string(self.call_id, "")
        self.final_label = AudioLabel(enum_value(self.final_label)) if not isinstance(self.final_label, AudioLabel) else self.final_label
        self.final_risk = RiskLevel(enum_value(self.final_risk)) if not isinstance(self.final_risk, RiskLevel) else self.final_risk

    def to_dict(self) -> Dict[str, Any]:
        return to_serializable(self)