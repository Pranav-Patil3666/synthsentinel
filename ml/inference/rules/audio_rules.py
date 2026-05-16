from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import librosa
import numpy as np

from ..config import RUNTIME, THRESHOLDS
from ..schemas import RiskLevel


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


def _risk_hint(score: float) -> RiskLevel:
    if score >= THRESHOLDS.high_risk_threshold:
        return RiskLevel.HIGH
    if score >= THRESHOLDS.medium_risk_threshold:
        return RiskLevel.MEDIUM
    return RiskLevel.LOW


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


@dataclass(slots=True)
class AudioRuleResult:
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


def evaluate_audio_chunk(
    y: np.ndarray,
    sr: int = RUNTIME.sample_rate,
    *,
    min_duration_sec: float | None = None,
) -> AudioRuleResult:
    """
    Conservative audio-quality heuristics.
    This does NOT replace VAD. It is an additional forensic quality gate.
    """

    min_duration_sec = float(min_duration_sec or RUNTIME.min_audio_duration_sec)

    reasons: List[str] = []
    votes: Dict[str, float] = {}
    details: Dict[str, Any] = {}

    if y is None:
        return AudioRuleResult(
            score=0.0,
            skip=True,
            risk_hint=RiskLevel.UNKNOWN,
            votes={"invalid_input": 1.0},
            reasons=["null_waveform"],
            details={"error": "waveform_is_none"},
        )

    y = np.asarray(y, dtype=np.float32)

    if y.size == 0:
        return AudioRuleResult(
            score=0.0,
            skip=True,
            risk_hint=RiskLevel.UNKNOWN,
            votes={"empty": 1.0},
            reasons=["empty_waveform"],
            details={"error": "empty_waveform"},
        )

    if not np.isfinite(y).all():
        return AudioRuleResult(
            score=0.0,
            skip=True,
            risk_hint=RiskLevel.UNKNOWN,
            votes={"non_finite": 1.0},
            reasons=["non_finite_samples"],
            details={"error": "non_finite_samples"},
        )

    duration_sec = float(len(y) / max(sr, 1))
    if duration_sec < min_duration_sec:
        return AudioRuleResult(
            score=0.0,
            skip=True,
            risk_hint=RiskLevel.UNKNOWN,
            votes={"too_short": 1.0},
            reasons=[f"duration<{min_duration_sec:.2f}s"],
            details={"duration_sec": duration_sec},
        )

    # Frame-level energy stats
    frame_rms = librosa.feature.rms(
        y=y,
        frame_length=2048,
        hop_length=512,
        center=True,
    )[0]

    if frame_rms.size == 0:
        frame_rms = np.array([float(np.sqrt(np.mean(np.square(y))))], dtype=np.float32)

    rms_mean = float(np.mean(frame_rms))
    rms_std = float(np.std(frame_rms))
    rms_median = float(np.median(frame_rms))

    silence_threshold = max(0.012, 0.35 * rms_median if rms_median > 0 else 0.012)
    silence_ratio = float(np.mean(frame_rms <= silence_threshold))

    clipping_ratio = float(np.mean(np.abs(y) >= 0.98))

    abs_y = np.abs(y)
    p95 = float(np.percentile(abs_y, 95))
    p10 = float(np.percentile(abs_y, 10))
    dynamic_range_db = float(20.0 * np.log10((p95 + 1e-8) / (p10 + 1e-8)))

    zcr = librosa.feature.zero_crossing_rate(y)[0]
    zcr_mean = float(np.mean(zcr)) if zcr.size else 0.0

    flatness = librosa.feature.spectral_flatness(y=y)[0]
    flatness_mean = float(np.mean(flatness)) if flatness.size else 0.0

    # Strong skip condition only for unusable audio
    if silence_ratio >= 0.95 and rms_mean <= 0.003:
        return AudioRuleResult(
            score=0.0,
            skip=True,
            risk_hint=RiskLevel.UNKNOWN,
            votes={"silence_only": 1.0},
            reasons=["silence_only_or_near_silence"],
            details={
                "duration_sec": duration_sec,
                "silence_ratio": silence_ratio,
                "rms_mean": rms_mean,
                "rms_std": rms_std,
                "clipping_ratio": clipping_ratio,
                "dynamic_range_db": dynamic_range_db,
                "zcr_mean": zcr_mean,
                "flatness_mean": flatness_mean,
            },
        )

    silence_score = _clamp01((silence_ratio - 0.35) / 0.55)
    low_energy_score = _clamp01((0.014 - rms_mean) / 0.014) if rms_mean < 0.014 else 0.0
    clipping_score = _clamp01(clipping_ratio / 0.02)
    dynamic_range_score = _clamp01((15.0 - dynamic_range_db) / 15.0) if dynamic_range_db < 15.0 else 0.0

    flatness_score = _clamp01((flatness_mean - 0.3) / 0.7) if flatness_mean > 0.3 else 0.0
    
    # Keep this conservative: we want strong anomalies only.

    score = (
        0.35 * silence_score
        + 0.25 * low_energy_score
        + 0.20 * clipping_score
        + 0.10 * dynamic_range_score
        + 0.10 * flatness_score   # add this
    )

    if silence_score >= 0.50:
        reasons.append("high_silence_ratio")
    if low_energy_score >= 0.50:
        reasons.append("low_energy")
    if clipping_score >= 0.50:
        reasons.append("clipping_present")
    if dynamic_range_score >= 0.50:
        reasons.append("low_dynamic_range")

    votes.update(
        {
            "silence_score": float(silence_score),
            "low_energy_score": float(low_energy_score),
            "clipping_score": float(clipping_score),
            "dynamic_range_score": float(dynamic_range_score),
        }
    )

    details.update(
        {
            "duration_sec": duration_sec,
            "silence_ratio": silence_ratio,
            "silence_threshold": silence_threshold,
            "rms_mean": rms_mean,
            "rms_std": rms_std,
            "clipping_ratio": clipping_ratio,
            "dynamic_range_db": dynamic_range_db,
            "zcr_mean": zcr_mean,
            "flatness_mean": flatness_mean,
        }
    )

    return AudioRuleResult(
        score=_clamp01(score),
        skip=False,
        risk_hint=_risk_hint(score),
        votes=votes,
        reasons=reasons,
        details=details,
    )