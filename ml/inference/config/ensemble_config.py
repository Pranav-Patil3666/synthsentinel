from __future__ import annotations

from dataclasses import dataclass
from typing import Dict

from ._base import env_float, safe_div


@dataclass(slots=True)
class EnsembleConfig:
    cnn_weight: float = env_float("SATARKRAHE_CNN_WEIGHT", 0.45)
    wav2vec2_weight: float = env_float("SATARKRAHE_WAV2VEC2_WEIGHT", 0.45)
    rules_weight: float = env_float("SATARKRAHE_RULES_WEIGHT", 0.10)

    agreement_boost: float = env_float("SATARKRAHE_AGREEMENT_BOOST", 0.05)
    disagreement_penalty: float = env_float("SATARKRAHE_DISAGREEMENT_PENALTY", 0.08)
    rule_boost_scale: float = env_float("SATARKRAHE_RULE_BOOST_SCALE", 0.15)

    use_logit_fusion: bool = False
    normalize_weights: bool = True

    def __post_init__(self) -> None:
        self.cnn_weight = max(0.0, float(self.cnn_weight))
        self.wav2vec2_weight = max(0.0, float(self.wav2vec2_weight))
        self.rules_weight = max(0.0, float(self.rules_weight))
        self.agreement_boost = max(0.0, float(self.agreement_boost))
        self.disagreement_penalty = max(0.0, float(self.disagreement_penalty))
        self.rule_boost_scale = max(0.0, float(self.rule_boost_scale))

    @property
    def total_weight(self) -> float:
        return self.cnn_weight + self.wav2vec2_weight + self.rules_weight

    def normalized(self) -> "EnsembleConfig":
        if not self.normalize_weights:
            return self

        total = self.total_weight
        if total <= 0:
            return EnsembleConfig()

        return EnsembleConfig(
            cnn_weight=safe_div(self.cnn_weight, total, 0.0),
            wav2vec2_weight=safe_div(self.wav2vec2_weight, total, 0.0),
            rules_weight=safe_div(self.rules_weight, total, 0.0),
            agreement_boost=self.agreement_boost,
            disagreement_penalty=self.disagreement_penalty,
            rule_boost_scale=self.rule_boost_scale,
            use_logit_fusion=self.use_logit_fusion,
            normalize_weights=self.normalize_weights,
        )

    def to_dict(self) -> Dict[str, float | bool]:
        return {
            "cnn_weight": self.cnn_weight,
            "wav2vec2_weight": self.wav2vec2_weight,
            "rules_weight": self.rules_weight,
            "agreement_boost": self.agreement_boost,
            "disagreement_penalty": self.disagreement_penalty,
            "rule_boost_scale": self.rule_boost_scale,
            "use_logit_fusion": self.use_logit_fusion,
            "normalize_weights": self.normalize_weights,
            "total_weight": self.total_weight,
        }


ENSEMBLE = EnsembleConfig()