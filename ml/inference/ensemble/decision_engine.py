from __future__ import annotations

from dataclasses import dataclass
from typing import Optional, Tuple

from ..config import THRESHOLDS
from ..schemas import AudioLabel, RiskLevel, SessionState


@dataclass(slots=True)
class DecisionOutcome:
    label: AudioLabel
    confidence: float
    risk: RiskLevel
    threshold: float
    reason: str


class DecisionEngine:
    """
    Converts a fused fake probability into final label + risk.
    Designed to be conservative for voice-forensics use.
    """

    def __init__(
        self,
        medium_threshold: float | None = None,
        high_threshold: float | None = None,
    ) -> None:
        self.medium_threshold = medium_threshold if medium_threshold is not None else THRESHOLDS.medium_risk_threshold
        self.high_threshold = high_threshold if high_threshold is not None else THRESHOLDS.high_risk_threshold

    def decide(
        self,
        fake_prob: float,
        *,
        threshold: float,
        session_state: SessionState | None = None,
        disagreement_score: float = 0.0,
        rule_score: float = 0.0,
    ) -> DecisionOutcome:
        fake_prob = max(0.0, min(1.0, float(fake_prob)))
        threshold = max(0.0, min(1.0, float(threshold)))

        label = AudioLabel.FAKE if fake_prob >= threshold else AudioLabel.REAL
        confidence = fake_prob if label == AudioLabel.FAKE else (1.0 - fake_prob)

        risk = RiskLevel.LOW
        reasons: list[str] = []

        # Base risk from probability
        if fake_prob >= self.high_threshold:
            risk = RiskLevel.HIGH
            reasons.append(f"fake_prob>={self.high_threshold:.2f}")
        elif fake_prob >= self.medium_threshold:
            risk = RiskLevel.MEDIUM
            reasons.append(f"fake_prob>={self.medium_threshold:.2f}")

        # Rule layer can only increase suspicion for now
        if rule_score >= 0.50 and risk == RiskLevel.LOW:
            risk = RiskLevel.MEDIUM
            reasons.append("rule_score>=0.50")

        if rule_score >= 0.80:
            risk = RiskLevel.HIGH
            reasons.append("rule_score>=0.80")

        # Strong disagreement should keep risk from staying LOW
        if disagreement_score >= THRESHOLDS.disagreement_delta and risk == RiskLevel.LOW:
            risk = RiskLevel.MEDIUM
            reasons.append(f"disagreement>={THRESHOLDS.disagreement_delta:.2f}")

        # Session-level persistence
        if session_state is not None:
            if session_state.fake_streak >= 3 and fake_prob >= threshold:
                risk = RiskLevel.HIGH
                reasons.append("fake_streak>=3")

            if session_state.medium_streak >= 2 and risk == RiskLevel.LOW:
                risk = RiskLevel.MEDIUM
                reasons.append("medium_streak>=2")

            if session_state.high_streak >= 2:
                risk = RiskLevel.HIGH
                reasons.append("high_streak>=2")

        reason = ", ".join(reasons) if reasons else "probability_threshold"

        return DecisionOutcome(
            label=label,
            confidence=confidence,
            risk=risk,
            threshold=threshold,
            reason=reason,
        )