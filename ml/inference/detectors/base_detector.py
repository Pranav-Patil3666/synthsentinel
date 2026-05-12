from __future__ import annotations

from abc import ABC, abstractmethod
from enum import Enum, auto
from pathlib import Path
from time import perf_counter
from typing import Any, Dict, Optional, Tuple, TypedDict

from ..config import PATHS, THRESHOLDS, RUNTIME
from ..schemas import AudioLabel, PredictionResult, RiskLevel
from ..utils.logging_utils import create_logger
from ..utils.device import get_device


# --- explicit return contract for _predict_raw ---

class RawPrediction(TypedDict):
    real_prob: float
    fake_prob: float
    skip: bool
    meta: Dict[str, Any]


# --- detector lifecycle state ---

class DetectorState(Enum):
    UNLOADED = auto()
    LOADED = auto()
    FAILED = auto()


class BaseDetector(ABC):
    """
    Base contract for all detectors.
    Subclasses only need to implement:
      - load()
      - _predict_raw(file_path) -> RawPrediction
    """

    def __init__(
        self,
        detector_name: str,
        model_version: Optional[str] = None,
        threshold: Optional[float] = None,
        device=None,
        logger=None,
    ) -> None:
        self.detector_name = detector_name
        self.model_version = model_version or PATHS.snapshot_name
        self.threshold = float(threshold) if threshold is not None else 0.5
        self.device = device or get_device(RUNTIME.prefer_cuda)
        self.logger = logger or create_logger(f"inference.detectors.{detector_name}")

        self._state: DetectorState = DetectorState.UNLOADED
        self.model: Any = None

        try:
            self.load()
            self._state = DetectorState.LOADED
        except Exception as exc:
            self._state = DetectorState.FAILED
            self.logger.exception(f"[{self.detector_name}] Failed to load: {exc}")
            raise

    
    # Properties
    

    @property
    def loaded(self) -> bool:
        return self._state == DetectorState.LOADED

    
    # Abstract interface
    

    @abstractmethod
    def load(self) -> None:
        """Load model weights, processor, and any required artifacts."""
        ...

    @abstractmethod
    def _predict_raw(self, file_path: Path) -> RawPrediction:
        """
        Run raw inference on the given audio file.

        Returns a RawPrediction TypedDict:
            real_prob : float  — probability of being real audio
            fake_prob : float  — probability of being fake/deepfake
            skip      : bool   — if True, result will be marked UNKNOWN
            meta      : dict   — any extra diagnostic info
        """
        ...

    
    # Internal helpers
    

    def _risk_from_fake_prob(self, fake_prob: float) -> RiskLevel:
        if fake_prob >= THRESHOLDS.high_risk_threshold:
            return RiskLevel.HIGH
        if fake_prob >= THRESHOLDS.medium_risk_threshold:
            return RiskLevel.MEDIUM
        return RiskLevel.LOW

    def _label_from_fake_prob(self, fake_prob: float) -> AudioLabel:
        return AudioLabel.FAKE if fake_prob >= self.threshold else AudioLabel.REAL

    def _assert_loaded(self) -> None:
        if self._state == DetectorState.FAILED:
            raise RuntimeError(
                f"[{self.detector_name}] Detector failed to load and cannot run inference."
            )
        if self._state == DetectorState.UNLOADED:
            raise RuntimeError(
                f"[{self.detector_name}] Detector is not yet loaded."
            )

    
    # Public predict interface
    

    def predict_file(
        self,
        file_path: str | Path,
        chunk_index: Optional[int] = None,
        session_id: Optional[str] = None,
        meta: Optional[Dict[str, Any]] = None,
    ) -> PredictionResult:
        self._assert_loaded()

        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"Audio file not found: {file_path}")

        extra_meta: Dict[str, Any] = dict(meta or {})

        start = perf_counter()
        raw: RawPrediction = self._predict_raw(file_path)
        latency_ms = (perf_counter() - start) * 1000.0

        extra_meta.update(raw.get("meta") or {})

        # --- shared kwargs for both skip and normal paths ---
        base_kwargs: Dict[str, Any] = dict(
            detector=self.detector_name,
            threshold=self.threshold,
            model_name=self.detector_name,
            model_version=self.model_version,
            chunk_index=chunk_index,
            chunk_path=str(file_path),
            session_id=session_id,          # ✅ always passed
            latency_ms=latency_ms,
            meta=extra_meta,
        )

        if raw["skip"]:
            return PredictionResult(
                **base_kwargs,
                label=AudioLabel.UNKNOWN,
                confidence=0.0,
                real_prob=0.0,
                fake_prob=0.0,
                risk=RiskLevel.UNKNOWN,
                skip=True,
            )

        real_prob = float(raw["real_prob"])
        fake_prob = float(raw["fake_prob"])
        label = self._label_from_fake_prob(fake_prob)
        confidence = fake_prob if label == AudioLabel.FAKE else real_prob
        risk = self._risk_from_fake_prob(fake_prob)

        return PredictionResult(
            **base_kwargs,
            label=label,
            confidence=confidence,
            real_prob=real_prob,
            fake_prob=fake_prob,
            risk=risk,
            skip=False,
        )

    def predict(
        self,
        file_path: str | Path,
        **kwargs: Any,
    ) -> PredictionResult:
        return self.predict_file(file_path, **kwargs)