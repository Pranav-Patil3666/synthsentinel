from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any, Dict, Optional

from .base_schema import clamp_probability, enum_value, normalize_string, to_serializable, utc_now_iso
from .prediction_schema import AudioLabel, RiskLevel, PredictionResult


@dataclass(slots=True)
class ModelContribution:
    name: str
    weight: float
    label: AudioLabel | str
    fake_prob: float
    real_prob: float
    confidence: float
    threshold: float
    risk: RiskLevel | str = RiskLevel.UNKNOWN
    skip: bool = False
    meta: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.name = normalize_string(self.name, "unknown")
        self.weight = max(0.0, float(self.weight))
        self.label = AudioLabel(enum_value(self.label)) if not isinstance(self.label, AudioLabel) else self.label
        self.risk = RiskLevel(enum_value(self.risk)) if not isinstance(self.risk, RiskLevel) else self.risk
        self.fake_prob = clamp_probability(self.fake_prob)
        self.real_prob = clamp_probability(self.real_prob)
        self.confidence = clamp_probability(self.confidence, default=max(self.real_prob, self.fake_prob))
        self.threshold = clamp_probability(self.threshold, default=0.5)
        if self.skip:
            self.label = AudioLabel.UNKNOWN
            self.risk = RiskLevel.UNKNOWN

    @classmethod
    def from_prediction(cls, pred: PredictionResult, weight: float = 1.0) -> "ModelContribution":
        return cls(
            name=pred.detector,
            weight=weight,
            label=pred.label,
            fake_prob=pred.fake_prob,
            real_prob=pred.real_prob,
            confidence=pred.confidence,
            threshold=pred.threshold,
            risk=pred.risk,
            skip=pred.skip,
            meta=pred.meta.copy(),
        )

    def to_dict(self) -> Dict[str, Any]:
        return to_serializable(self)


@dataclass(slots=True)
class EnsembleWeights:
    cnn: float = 0.45
    wav2vec2: float = 0.45
    rules: float = 0.10

    def __post_init__(self) -> None:
        self.cnn = max(0.0, float(self.cnn))
        self.wav2vec2 = max(0.0, float(self.wav2vec2))
        self.rules = max(0.0, float(self.rules))

    @property
    def total(self) -> float:
        return self.cnn + self.wav2vec2 + self.rules

    def normalized(self) -> "EnsembleWeights":
        total = self.total
        if total <= 0:
            return EnsembleWeights()
        return EnsembleWeights(
            cnn=self.cnn / total,
            wav2vec2=self.wav2vec2 / total,
            rules=self.rules / total,
        )

    def to_dict(self) -> Dict[str, Any]:
        return to_serializable(self)


@dataclass(slots=True)
class FusionResult:
    label: AudioLabel | str
    fake_prob: float
    real_prob: float
    confidence: float
    risk: RiskLevel | str
    threshold: float

    cnn: Optional[ModelContribution] = None
    wav2vec2: Optional[ModelContribution] = None

    rule_score: float = 0.0
    rule_votes: Dict[str, float] = field(default_factory=dict)

    agreement_score: float = 0.0
    disagreement_score: float = 0.0
    skipped: bool = False
    risk_reason: str = ""

    session_id: Optional[str] = None
    chunk_index: Optional[int] = None
    timestamp_utc: str = field(default_factory=utc_now_iso)
    meta: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        self.label = AudioLabel(enum_value(self.label)) if not isinstance(self.label, AudioLabel) else self.label
        self.risk = RiskLevel(enum_value(self.risk)) if not isinstance(self.risk, RiskLevel) else self.risk

        self.fake_prob = clamp_probability(self.fake_prob)
        self.real_prob = clamp_probability(self.real_prob)
        self.confidence = clamp_probability(self.confidence, default=max(self.real_prob, self.fake_prob))
        self.threshold = clamp_probability(self.threshold, default=0.5)

        self.rule_score = float(self.rule_score)
        self.agreement_score = max(0.0, min(1.0, float(self.agreement_score)))
        self.disagreement_score = max(0.0, min(1.0, float(self.disagreement_score)))

        self.risk_reason = normalize_string(self.risk_reason, "")
        self.session_id = normalize_string(self.session_id, "") or None

    def to_dict(self) -> Dict[str, Any]:
        return to_serializable(self)