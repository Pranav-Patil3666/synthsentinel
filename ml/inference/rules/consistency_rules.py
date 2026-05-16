from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from ..config import THRESHOLDS
from ..schemas import AudioLabel, RiskLevel


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _get(obj: Any, name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _to_label(value: Any) -> AudioLabel:
    if isinstance(value, AudioLabel):
        return value
    try:
        return AudioLabel(str(value))
    except Exception:
        return AudioLabel.UNKNOWN


def _risk_hint(score: float) -> RiskLevel:
    if score >= THRESHOLDS.high_risk_threshold:
        return RiskLevel.HIGH
    if score >= THRESHOLDS.medium_risk_threshold:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


@dataclass(slots=True)
class ConsistencyRuleResult:
    score: float
    skip: bool
    risk_hint: RiskLevel
    votes: Dict[str, float] = field(default_factory=dict)
    reasons: List[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)
    timestamp_utc: str = field(default_factory=_utc_now)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "score": float(self.score),
            "skip": bool(self.skip),
            "risk_hint": self.risk_hint.value,
            "votes": self.votes,
            "reasons": self.reasons,
            "details": self.details,
            "timestamp_utc": self.timestamp_utc,
        }


def _extract_pred(pred: Any) -> Dict[str, Any] | None:
    if pred is None:
        return None

    skip = bool(_get(pred, "skip", False))
    if skip:
        return None

    fake_prob = float(_get(pred, "fake_prob", 0.0))
    real_prob = float(_get(pred, "real_prob", 0.0))
    confidence = float(_get(pred, "confidence", max(fake_prob, real_prob)))
    label = _to_label(_get(pred, "label", AudioLabel.UNKNOWN))
    detector = str(_get(pred, "detector", _get(pred, "model_name", "unknown")))

    return {
        "detector": detector,
        "label": label,
        "fake_prob": fake_prob,
        "real_prob": real_prob,
        "confidence": confidence,
    }


def evaluate_detector_consistency(
    cnn_pred: Any | None = None,
    wav2vec2_pred: Any | None = None,
) -> ConsistencyRuleResult:
    """
    Cross-model consistency rules.
    """
    cnn = _extract_pred(cnn_pred)
    wav = _extract_pred(wav2vec2_pred)

    if cnn is None and wav is None:
        return ConsistencyRuleResult(
            score=0.0,
            skip=True,
            risk_hint=RiskLevel.UNKNOWN,
            votes={"all_detectors_skipped": 1.0},
            reasons=["all_detectors_skipped"],
            details={},
        )

    if cnn is None or wav is None:
        # One model available only — no true consistency signal
        pred = cnn or wav
        assert pred is not None

        single_fake = float(pred["fake_prob"])
        single_conf = float(pred["confidence"])
        score = _clamp01(max(0.0, single_fake - 0.5) * 0.35)

        return ConsistencyRuleResult(
            score=score,
            skip=False,
            risk_hint=_risk_hint(score),
            votes={
                "single_detector_available": 1.0,
                "single_detector_fake_prob": single_fake,
                "single_detector_confidence": single_conf,
            },
            reasons=["single_detector_only"],
            details={
                "detector": pred["detector"],
                "label": pred["label"].value,
                "fake_prob": single_fake,
                "confidence": single_conf,
            },
        )

    cnn_fake = float(cnn["fake_prob"])
    wav_fake = float(wav["fake_prob"])
    cnn_conf = float(cnn["confidence"])
    wav_conf = float(wav["confidence"])
    cnn_label = cnn["label"]
    wav_label = wav["label"]

    gap = abs(cnn_fake - wav_fake)
    confidence_gap = abs(cnn_conf - wav_conf)

    same_label = cnn_label == wav_label
    both_fake = cnn_label == AudioLabel.FAKE and wav_label == AudioLabel.FAKE
    both_real = cnn_label == AudioLabel.REAL and wav_label == AudioLabel.REAL

    if both_fake:
        score = _clamp01(
            0.50 * ((cnn_fake + wav_fake) / 2.0)
            + 0.25 * min(cnn_conf, wav_conf)
            + 0.25 * (1.0 - min(1.0, gap))
        )
        reasons = ["both_fake"]
    elif both_real:
        avg_fake = (cnn_fake + wav_fake) / 2.0
        score = _clamp01(0.05 * gap + 0.10 * avg_fake)
        reasons = ["both_real"]
        
    else:
        # Strong disagreement is not automatically fake, but it is suspicious.
        score = _clamp01(
            0.30 * max(cnn_fake, wav_fake)
            + 0.45 * min(1.0, gap / max(1e-8, THRESHOLDS.disagreement_delta))
            + 0.25 * confidence_gap
        )
        reasons = ["detector_disagreement"]

    votes = {
        "cnn_fake_prob": cnn_fake,
        "wav2vec2_fake_prob": wav_fake,
        "gap": gap,
        "confidence_gap": confidence_gap,
        "same_label": 1.0 if same_label else 0.0,
        "both_fake": 1.0 if both_fake else 0.0,
        "both_real": 1.0 if both_real else 0.0,
    }

    details = {
        "cnn": cnn,
        "wav2vec2": wav,
        "gap": gap,
        "confidence_gap": confidence_gap,
        "same_label": same_label,
    }

    return ConsistencyRuleResult(
        score=score,
        skip=False,
        risk_hint=_risk_hint(score),
        votes=votes,
        reasons=reasons,
        details=details,
    )