from __future__ import annotations

from dataclasses import asdict
from typing import Any, Dict, Iterable, Optional

from ..config import ENSEMBLE, THRESHOLDS
from ..schemas import (
    AudioLabel,
    PredictionResult,
    EnsembleWeights,
    FusionResult,
    ModelContribution,
    RiskLevel,
    SessionState,
)
from .decision_engine import DecisionEngine
from .weighting import BASELINE_WEIGHTS


def _get(obj: Any, name: str, default: Any = None) -> Any:
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


def _clamp01(x: float) -> float:
    return max(0.0, min(1.0, float(x)))


class EnsembleFusionEngine:
    """
    Fuses CNN + Wav2Vec2 + optional rule score into a single final result.
    Rules are optional for now: pass rule_score=0.0 until the rule engine exists.
    """

    def __init__(
        self,
        weights: EnsembleWeights | None = None,
        decision_engine: DecisionEngine | None = None,
        final_threshold: float | None = None,
    ) -> None:
        self.weights = (weights or BASELINE_WEIGHTS).normalized()
        self.decision_engine = decision_engine or DecisionEngine()
        self.final_threshold = final_threshold  # if None, derive dynamically from model thresholds

    def _to_contribution(
        self,
        pred: Any,
        default_name: str,
        weight: float,
    ) -> ModelContribution:
        """
        Accepts PredictionResult, RawPrediction-like objects, or dicts.
        This keeps the ensemble compatible with your updated detector contract.
        """
        if pred is None:
            raise ValueError(f"{default_name} prediction is None")

        if isinstance(pred, ModelContribution):
            return pred

        label = _get(pred, "label", AudioLabel.UNKNOWN)
        fake_prob = float(_get(pred, "fake_prob", 0.0))
        real_prob = float(_get(pred, "real_prob", 0.0))
        confidence = float(_get(pred, "confidence", max(fake_prob, real_prob)))
        threshold = float(_get(pred, "threshold", 0.5))
        risk = _get(pred, "risk", RiskLevel.UNKNOWN)
        skip = bool(_get(pred, "skip", False))
        detector = _get(pred, "detector", _get(pred, "model_name", default_name))
        meta = dict(_get(pred, "meta", {}) or {})

        return ModelContribution(
            name=str(detector),
            weight=float(weight),
            label=label,
            fake_prob=fake_prob,
            real_prob=real_prob,
            confidence=confidence,
            threshold=threshold,
            risk=risk,
            skip=skip,
            meta=meta,
        )

    def fuse(
        self,
        cnn_pred: Any | None = None,
        wav2vec2_pred: Any | None = None,
        *,
        rule_score: float = 0.0,
        rule_votes: Optional[Dict[str, float]] = None,
        session_state: SessionState | None = None,
        session_id: str | None = None,
        chunk_index: int | None = None,
        final_threshold: float | None = None,
    ) -> FusionResult:
        contributions: list[ModelContribution] = []

        if cnn_pred is not None:
            c = self._to_contribution(cnn_pred, "cnn", self.weights.cnn)
            if not c.skip:
                contributions.append(c)

        if wav2vec2_pred is not None:
            w = self._to_contribution(wav2vec2_pred, "wav2vec2", self.weights.wav2vec2)
            if not w.skip:
                contributions.append(w)

        if not contributions:
            return FusionResult(
                label=AudioLabel.UNKNOWN,
                fake_prob=0.0,
                real_prob=0.0,
                confidence=0.0,
                risk=RiskLevel.UNKNOWN,
                threshold=final_threshold if final_threshold is not None else 0.5,
                cnn=None,
                wav2vec2=None,
                rule_score=rule_score,
                rule_votes=rule_votes or {},
                agreement_score=0.0,
                disagreement_score=0.0,
                skipped=True,
                risk_reason="all_detectors_skipped",
                session_id=session_id,
                chunk_index=chunk_index,
                meta={},
            )

        cnn_contrib = next((c for c in contributions if c.name.lower().startswith("cnn")), None)
        wav2vec2_contrib = next((c for c in contributions if c.name.lower().startswith("wav2vec")), None)

        total_weight = sum(c.weight for c in contributions)
        if total_weight <= 0:
            total_weight = 1.0

        weighted_fake = sum(c.fake_prob * c.weight for c in contributions) / total_weight
        weighted_real = sum(c.real_prob * c.weight for c in contributions) / total_weight

        weighted_threshold = sum(c.threshold * c.weight for c in contributions) / total_weight

        # If an explicit ensemble threshold is provided, use it; otherwise use weighted detector thresholds.
        threshold = final_threshold if final_threshold is not None else (
            self.final_threshold if self.final_threshold is not None else weighted_threshold
        )

        labels = [c.label for c in contributions if c.label != AudioLabel.UNKNOWN]
        same_label = len(set(labels)) == 1 if labels else False

        fake_probs = [c.fake_prob for c in contributions]
        confidences = [c.confidence for c in contributions]

        disagreement_score = max(fake_probs) - min(fake_probs) if len(fake_probs) >= 2 else 0.0
        agreement_score = 1.0 - min(1.0, disagreement_score)

        avg_conf = sum(confidences) / len(confidences)

        # Conservative adjustment:
        # - agreement nudges score slightly
        # - disagreement nudges down confidence, not score too aggressively
        adjusted_fake = weighted_fake

        if same_label and labels[0] == AudioLabel.FAKE:
            adjusted_fake += self.weights.rules * 0.0 + 0.02 * avg_conf
        elif same_label and labels[0] == AudioLabel.REAL:
            adjusted_fake -= 0.02 * avg_conf

        # Rule score is optional now. Positive rule_score means "more suspicious".
        adjusted_fake += float(rule_score) * 0.15
        adjusted_fake -= disagreement_score * 0.08

        adjusted_fake = _clamp01(adjusted_fake)
        adjusted_real = 1.0 - adjusted_fake

        decision = self.decision_engine.decide(
            adjusted_fake,
            threshold=threshold,
            session_state=session_state,
            disagreement_score=disagreement_score,
            rule_score=rule_score,
        )

        result = FusionResult(
            label=decision.label,
            fake_prob=adjusted_fake,
            real_prob=adjusted_real,
            confidence=decision.confidence,
            risk=decision.risk,
            threshold=threshold,
            cnn=cnn_contrib,
            wav2vec2=wav2vec2_contrib,
            rule_score=float(rule_score),
            rule_votes=rule_votes or {},
            agreement_score=agreement_score,
            disagreement_score=disagreement_score,
            skipped=False,
            risk_reason=decision.reason,
            session_id=session_id,
            chunk_index=chunk_index,
            meta={
                "weights": self.weights.to_dict(),
                "weighted_fake": weighted_fake,
                "weighted_real": weighted_real,
                "weighted_threshold": weighted_threshold,
                "adjusted_fake": adjusted_fake,
            },
        )

        return result