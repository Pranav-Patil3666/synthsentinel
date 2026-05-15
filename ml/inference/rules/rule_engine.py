from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np

from ..config import RUNTIME, THRESHOLDS
from ..schemas import AudioLabel, RiskLevel, SessionState
from ..utils.audio import load_audio
from .audio_rules import AudioRuleResult, evaluate_audio_chunk
from .consistency_rules import ConsistencyRuleResult, evaluate_detector_consistency
from .temporal_rules import TemporalRuleResult, evaluate_temporal_consistency


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


def _to_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except Exception:
        return default


@dataclass(slots=True)
class RuleResult:
    rule_score: float
    risk: RiskLevel
    skip: bool
    votes: Dict[str, float] = field(default_factory=dict)
    reasons: list[str] = field(default_factory=list)
    details: Dict[str, Any] = field(default_factory=dict)

    audio: Optional[AudioRuleResult] = None
    temporal: Optional[TemporalRuleResult] = None
    consistency: Optional[ConsistencyRuleResult] = None

    session_id: Optional[str] = None
    chunk_index: Optional[int] = None
    timestamp_utc: str = field(default_factory=_utc_now)
    meta: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_score": float(self.rule_score),
            "risk": self.risk.value,
            "skip": bool(self.skip),
            "votes": self.votes,
            "reasons": self.reasons,
            "details": self.details,
            "audio": self.audio.to_dict() if self.audio else None,
            "temporal": self.temporal.to_dict() if self.temporal else None,
            "consistency": self.consistency.to_dict() if self.consistency else None,
            "session_id": self.session_id,
            "chunk_index": self.chunk_index,
            "timestamp_utc": self.timestamp_utc,
            "meta": self.meta,
        }


class RuleEngine:
    """
    Conservative forensic rule engine.
    Lives in ML side, not backend.
    Backend should only consume the final RuleResult / fused result.
    """

    def __init__(
        self,
        audio_weight: float = 0.35,
        temporal_weight: float = 0.40,
        consistency_weight: float = 0.25,
    ) -> None:
        self.audio_weight = max(0.0, float(audio_weight))
        self.temporal_weight = max(0.0, float(temporal_weight))
        self.consistency_weight = max(0.0, float(consistency_weight))

    @property
    def total_weight(self) -> float:
        return self.audio_weight + self.temporal_weight + self.consistency_weight

    def _normalized_weights(self) -> tuple[float, float, float]:
        total = self.total_weight
        if total <= 0:
            return (0.35, 0.40, 0.25)
        return (
            self.audio_weight / total,
            self.temporal_weight / total,
            self.consistency_weight / total,
        )

    def _extract_current_fake_prob(
        self,
        cnn_pred: Any | None,
        wav2vec2_pred: Any | None,
    ) -> float | None:
        probs: list[float] = []

        for pred in (cnn_pred, wav2vec2_pred):
            if pred is None:
                continue
            if bool(_get(pred, "skip", False)):
                continue
            probs.append(_to_float(_get(pred, "fake_prob", 0.0), 0.0))

        if not probs:
            return None

        return float(sum(probs) / len(probs))

    def evaluate(
        self,
        *,
        audio_path: str | Path | None = None,
        waveform: np.ndarray | None = None,
        sample_rate: int | None = None,
        cnn_pred: Any | None = None,
        wav2vec2_pred: Any | None = None,
        session_state: SessionState | None = None,
        session_id: str | None = None,
        chunk_index: int | None = None,
    ) -> RuleResult:
        """
        Inputs:
          - audio_path OR waveform (for audio heuristics)
          - cnn_pred / wav2vec2_pred (for consistency)
          - session_state (for temporal rules)
        """

        audio_result: AudioRuleResult | None = None
        temporal_result: TemporalRuleResult | None = None
        consistency_result: ConsistencyRuleResult | None = None

        # -------------------------
        # AUDIO RULES
        # -------------------------
        if waveform is None and audio_path is not None:
            audio_sr = int(sample_rate or RUNTIME.sample_rate)
            waveform, _ = load_audio(audio_path, sample_rate=audio_sr, mono=True, normalize=False)
            sample_rate = audio_sr

        if waveform is not None:
            audio_result = evaluate_audio_chunk(
                np.asarray(waveform, dtype=np.float32),
                sr=int(sample_rate or RUNTIME.sample_rate),
            )

            if audio_result.skip:
                return RuleResult(
                    rule_score=0.0,
                    risk=RiskLevel.UNKNOWN,
                    skip=True,
                    votes=dict(audio_result.votes),
                    reasons=list(audio_result.reasons),
                    details={
                        "audio": audio_result.details,
                        "early_exit": "audio_skip",
                    },
                    audio=audio_result,
                    temporal=None,
                    consistency=None,
                    session_id=session_id,
                    chunk_index=chunk_index,
                    meta={
                        "source": "rule_engine",
                        "reason": "audio_skip",
                    },
                )

        # -------------------------
        # TEMPORAL RULES
        # -------------------------
        current_fake_prob = self._extract_current_fake_prob(cnn_pred, wav2vec2_pred)
        current_label = (
            AudioLabel.FAKE if (current_fake_prob is not None and current_fake_prob >= 0.5) else
            AudioLabel.REAL if current_fake_prob is not None else
            AudioLabel.UNKNOWN
        )

        if session_state is not None:
            temporal_result = evaluate_temporal_consistency(
                session_state,
                current_fake_prob=current_fake_prob,
                current_label=current_label,
            )
        else:
            temporal_result = evaluate_temporal_consistency(
                None,
                current_fake_prob=current_fake_prob,
                current_label=current_label,
            )

        # -------------------------
        # CONSISTENCY RULES
        # -------------------------
        consistency_result = evaluate_detector_consistency(
            cnn_pred=cnn_pred,
            wav2vec2_pred=wav2vec2_pred,
        )

        # If everything is missing / skipped, signal skip
        if consistency_result.skip and audio_result is None and temporal_result is not None and temporal_result.score == 0.0:
            return RuleResult(
                rule_score=0.0,
                risk=RiskLevel.UNKNOWN,
                skip=True,
                votes=dict(consistency_result.votes),
                reasons=list(consistency_result.reasons),
                details={"consistency": consistency_result.details},
                audio=audio_result,
                temporal=temporal_result,
                consistency=consistency_result,
                session_id=session_id,
                chunk_index=chunk_index,
                meta={
                    "source": "rule_engine",
                    "reason": "all_detectors_skipped",
                },
            )

        # -------------------------
        # COMBINE
        # -------------------------
        w_audio, w_temp, w_cons = self._normalized_weights()

        components: list[tuple[str, float, Dict[str, float], list[str], Dict[str, Any]]] = []

        if audio_result is not None:
            components.append(
                (
                    "audio",
                    audio_result.score,
                    audio_result.votes,
                    audio_result.reasons,
                    audio_result.details,
                )
            )

        if temporal_result is not None:
            components.append(
                (
                    "temporal",
                    temporal_result.score,
                    temporal_result.votes,
                    temporal_result.reasons,
                    temporal_result.details,
                )
            )

        if consistency_result is not None:
            components.append(
                (
                    "consistency",
                    consistency_result.score,
                    consistency_result.votes,
                    consistency_result.reasons,
                    consistency_result.details,
                )
            )

        weight_map = {
            "audio": w_audio,
            "temporal": w_temp,
            "consistency": w_cons,
        }

        weighted_sum = 0.0
        weight_used = 0.0
        votes: Dict[str, float] = {}
        reasons: list[str] = []
        details: Dict[str, Any] = {}

        for name, score, comp_votes, comp_reasons, comp_details in components:
            weight = weight_map.get(name, 0.0)
            if weight <= 0:
                continue
            weighted_sum += weight * float(score)
            weight_used += weight

            for k, v in comp_votes.items():
                votes[f"{name}.{k}"] = float(v)

            for r in comp_reasons:
                if r not in reasons:
                    reasons.append(r)

            details[name] = comp_details

        if weight_used <= 0:
            rule_score = 0.0
        else:
            rule_score = _clamp01(weighted_sum / weight_used)

        if rule_score >= THRESHOLDS.high_risk_threshold:
            risk = RiskLevel.HIGH
        elif rule_score >= THRESHOLDS.medium_risk_threshold:
            risk = RiskLevel.MEDIUM
        else:
            risk = RiskLevel.LOW

        # Small persistence boost if the session already looks bad
        if session_state is not None:
            if session_state.fake_streak >= THRESHOLDS.fake_high_count_min_hits:
                rule_score = max(rule_score, 0.85)
                risk = RiskLevel.HIGH
                reasons.append("session_fake_streak")
            elif session_state.medium_streak >= THRESHOLDS.medium_count_min_hits and risk == RiskLevel.LOW:
                rule_score = max(rule_score, 0.55)
                risk = RiskLevel.MEDIUM
                reasons.append("session_medium_streak")

        return RuleResult(
            rule_score=_clamp01(rule_score),
            risk=risk,
            skip=False,
            votes=votes,
            reasons=reasons,
            details=details,
            audio=audio_result,
            temporal=temporal_result,
            consistency=consistency_result,
            session_id=session_id,
            chunk_index=chunk_index,
            meta={
                "weights": {
                    "audio": w_audio,
                    "temporal": w_temp,
                    "consistency": w_cons,
                },
                "source": "rule_engine",
            },
        )