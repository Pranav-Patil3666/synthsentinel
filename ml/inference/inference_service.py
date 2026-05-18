from __future__ import annotations

import tempfile
import threading
import uuid
from dataclasses import asdict, is_dataclass
from pathlib import Path
from typing import Any, Dict, Optional

import numpy as np

from .config import PATHS, THRESHOLDS, RUNTIME, ENSEMBLE
from .detectors import CNNDetector, Wav2Vec2Detector
from .ensemble import EnsembleFusionEngine
from .rules import RuleEngine, evaluate_audio_chunk
from .schemas import (
    AudioLabel,
    ChunkObservation,
    FusionResult,
    RiskLevel,
    SessionState,
    SessionSummary,
)
from .utils.audio import load_audio, save_audio
from .utils.logging_utils import create_logger


def _serialize(obj: Any) -> Any:
    if obj is None:
        return None
    if hasattr(obj, "to_dict") and callable(getattr(obj, "to_dict")):
        return obj.to_dict()
    if is_dataclass(obj):
        return asdict(obj)      # type: ignore[arg-type]
    if isinstance(obj, dict):
        return obj
    if isinstance(obj, (list, tuple)):
        return [_serialize(v) for v in obj]
    return obj


def _ensure_path(value: str | Path) -> Path:
    return value if isinstance(value, Path) else Path(value)


class InferenceService:
    """
    Master orchestration layer.

    Pipeline:
        audio chunk
            ↓
        audio quality gate / skip
            ↓
        CNN detector
        Wav2Vec2 detector
            ↓
        rule engine
            ↓
        ensemble fusion
            ↓
        session risk update
            ↓
        final response
    """

    def __init__(
        self,
        *,
        cnn_model_path: str | Path | None = None,
        wav2vec2_model_dir: str | Path | None = None,
        session_name: str | None = None,
        enable_rules: bool = True,
    ) -> None:
        self.logger = create_logger("inference.service")

        self.session_name = session_name or PATHS.snapshot_name
        self.enable_rules = enable_rules

        self._sessions: Dict[str, SessionState] = {}
        self._lock = threading.RLock()

        # Frozen, fixed-threshold detectors
        self.cnn = CNNDetector(
            model_path=cnn_model_path or PATHS.cnn_best_path,
            threshold=THRESHOLDS.cnn_fake_threshold,
        )

        self.wav2vec2 = Wav2Vec2Detector(
            model_dir=wav2vec2_model_dir or PATHS.wav2vec2_best_dir,
            threshold=THRESHOLDS.wav2vec2_fake_threshold,
        )

        self.rule_engine = RuleEngine()

        # Fixed ensemble weights for now; no calibration layer involved
        self.ensemble = EnsembleFusionEngine(
            weights=ENSEMBLE.normalized(),
            final_threshold=None,  # let detector thresholds + ensemble logic drive this
        )

        self.logger.info(
            "InferenceService initialized | "
            f"snapshot={self.session_name} | "
            f"cnn_thr={THRESHOLDS.cnn_fake_threshold:.2f} | "
            f"wav2vec_thr={THRESHOLDS.wav2vec2_fake_threshold:.2f}"
        )

    def _resolve_session_id(self, session_id: str | None) -> str:
        return session_id or uuid.uuid4().hex

    def _get_or_create_session(
        self,
        session_id: str,
        *,
        call_id: str | None = None,
    ) -> SessionState:
        with self._lock:
            if session_id not in self._sessions:
                self._sessions[session_id] = SessionState(
                    session_id=session_id,
                    call_id=call_id or "",
                    rolling_window=THRESHOLDS.fake_high_count_window,
                )
            else:
                if call_id and not self._sessions[session_id].call_id:
                    self._sessions[session_id].call_id = call_id
            return self._sessions[session_id]

    def get_session(self, session_id: str) -> SessionState | None:
        with self._lock:
            return self._sessions.get(session_id)

    def reset_session(self, session_id: str) -> bool:
        with self._lock:
            return self._sessions.pop(session_id, None) is not None

    def list_sessions(self) -> list[str]:
        with self._lock:
            return list(self._sessions.keys())

    def _safe_predict_detector(
        self,
        detector,
        audio_path: Path,
        *,
        session_id: str,
        chunk_index: int | None,
    ) -> Any:
        try:
            return detector.predict(
                audio_path,
                session_id=session_id,
                chunk_index=chunk_index,
            )
        except Exception as exc:
            self.logger.exception(f"{detector.detector_name} prediction failed")
            return {
                "detector": detector.detector_name,
                "label": AudioLabel.UNKNOWN,
                "confidence": 0.0,
                "real_prob": 0.0,
                "fake_prob": 0.0,
                "threshold": getattr(detector, "threshold", 0.5),
                "risk": RiskLevel.UNKNOWN,
                "skip": True,
                "session_id": session_id,
                "chunk_index": chunk_index,
                "meta": {
                    "error": str(exc),
                    "model_version": self.session_name,
                },
            }

    def _build_session_summary(self, session: SessionState) -> Dict[str, Any]:
        real_votes = sum(1 for c in session.chunk_history if c.label == AudioLabel.REAL)
        fake_votes = sum(1 for c in session.chunk_history if c.label == AudioLabel.FAKE)
        med_votes = sum(1 for c in session.chunk_history if c.risk == RiskLevel.MEDIUM)
        high_votes = sum(1 for c in session.chunk_history if c.risk == RiskLevel.HIGH)

        fake_probs = session.fake_probs or [0.0]
        real_probs = session.real_probs or [1.0]

        summary = SessionSummary(
            session_id=session.session_id,
            call_id=session.call_id,
            total_chunks=session.total_chunks,
            processed_chunks=len(session.chunk_history),
            skipped_chunks=session.skipped_chunks,
            real_votes=real_votes,
            fake_votes=fake_votes,
            medium_risk_votes=med_votes,
            high_risk_votes=high_votes,
            final_label=session.last_label,
            final_risk=session.last_risk,
            avg_fake_prob=float(np.mean(fake_probs)),
            max_fake_prob=float(np.max(fake_probs)),
            min_fake_prob=float(np.min(fake_probs)),
            smoothed_fake_prob=float(session.smoothed_fake_prob),
            start_time_utc=session.created_at_utc,
            end_time_utc=session.updated_at_utc,
            meta={
                "peak_fake_prob": float(session.peak_fake_prob),
                "min_fake_prob": float(session.min_fake_prob),
                "fake_streak": int(session.fake_streak),
                "real_streak": int(session.real_streak),
                "medium_streak": int(session.medium_streak),
                "high_streak": int(session.high_streak),
            },
        )

        return summary.to_dict()

    def _build_base_response(
        self,
        *,
        session_id: str,
        chunk_index: int | None,
        audio_path: str | None,
        audio_rule: Any | None,
        cnn_pred: Any | None,
        wav2vec2_pred: Any | None,
        rule_result: Any | None,
        fusion_result: Any | None,
        session: SessionState,
        skipped: bool = False,
        skip_reason: str | None = None,
        sample_rate: int | None = None,
        duration_sec: float | None = None,
    ) -> Dict[str, Any]:
        final = None
        if fusion_result is not None:
            final = {
                "label": fusion_result.label.value,
                "confidence": float(fusion_result.confidence),
                "real_prob": float(fusion_result.real_prob),
                "fake_prob": float(fusion_result.fake_prob),
                "risk": fusion_result.risk.value,
                "threshold": float(fusion_result.threshold),
                "skipped": bool(fusion_result.skipped),
            }

        return {
            "session_id": session_id,
            "chunk_index": chunk_index,
            "audio_path": audio_path,
            "sample_rate": sample_rate,
            "duration_sec": duration_sec,
            "skipped": bool(skipped),
            "skip_reason": skip_reason,
            "audio_rule": _serialize(audio_rule),
            "cnn": _serialize(cnn_pred),
            "wav2vec2": _serialize(wav2vec2_pred),
            "rules": _serialize(rule_result),
            "ensemble": _serialize(fusion_result),
            "final": final
            or {
                "label": AudioLabel.UNKNOWN.value,
                "confidence": 0.0,
                "real_prob": 0.0,
                "fake_prob": 0.0,
                "risk": RiskLevel.UNKNOWN.value,
                "threshold": float(THRESHOLDS.wav2vec2_fake_threshold),
                "skipped": True,
            },
            "session_summary": self._build_session_summary(session),
            "thresholds": {
                "cnn_fake_threshold": float(THRESHOLDS.cnn_fake_threshold),
                "wav2vec2_fake_threshold": float(THRESHOLDS.wav2vec2_fake_threshold),
                "medium_risk_threshold": float(THRESHOLDS.medium_risk_threshold),
                "high_risk_threshold": float(THRESHOLDS.high_risk_threshold),
            },
            "ensemble_weights": ENSEMBLE.normalized().to_dict(),
            "model_versions": {
                "cnn": self.session_name,
                "wav2vec2": self.session_name,
            },
        }

    def predict(
        self,
        *,
        audio_path: str | Path | None = None,
        waveform: np.ndarray | None = None,
        sample_rate: int | None = None,
        session_id: str | None = None,
        call_id: str | None = None,
        chunk_index: int | None = None,
    ) -> Dict[str, Any]:
        """
        Main inference entrypoint.

        Use either:
          - audio_path (preferred for backend chunk files)
          - waveform + sample_rate (future direct-memory path)
        """
        resolved_session_id = self._resolve_session_id(session_id)
        session = self._get_or_create_session(resolved_session_id, call_id=call_id)

        temp_audio_path: Path | None = None
        delete_temp = False

        try:
            # Materialize input into a file for the detectors if needed
            if audio_path is None and waveform is None:
                raise ValueError("Either audio_path or waveform must be provided.")

            if audio_path is None and waveform is not None:
                sr = int(sample_rate or RUNTIME.sample_rate)
                temp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
                temp.close()
                temp_audio_path = Path(temp.name)
                save_audio(temp_audio_path, waveform, sr=sr)
                audio_path = temp_audio_path
                delete_temp = True

            audio_path = _ensure_path(audio_path)  # type: ignore[arg-type]
            if not audio_path.exists():
                raise FileNotFoundError(f"Audio file not found: {audio_path}")

            # Load waveform once for rule heuristics
            if waveform is None:
                waveform, sample_rate = load_audio(
                    audio_path,
                    sample_rate=RUNTIME.sample_rate,
                    mono=True,
                    normalize=False,
                )
            else:
                waveform = np.asarray(waveform, dtype=np.float32)
                sample_rate = int(sample_rate or RUNTIME.sample_rate)

            duration_sec = float(len(waveform) / max(sample_rate, 1))

            
            # STEP 1: AUDIO QUALITY GATE (fixed thresholds only)
            
            audio_rule = evaluate_audio_chunk(
                waveform,
                sr=sample_rate,
            )

            if audio_rule.skip:
                with self._lock:
                    session.skipped_chunks += 1
                    session.updated_at_utc = session.updated_at_utc

                fusion = self.ensemble.fuse(
                    None,
                    None,
                    rule_score=audio_rule.score,
                    rule_votes=audio_rule.votes,
                    session_state=session,
                    session_id=resolved_session_id,
                    chunk_index=chunk_index,
                )

                return self._build_base_response(
                    session_id=resolved_session_id,
                    chunk_index=chunk_index,
                    audio_path=str(audio_path),
                    audio_rule=audio_rule,
                    cnn_pred=None,
                    wav2vec2_pred=None,
                    rule_result=None,
                    fusion_result=fusion,
                    session=session,
                    skipped=True,
                    skip_reason="audio_rule_skip",
                    sample_rate=sample_rate,
                    duration_sec=duration_sec,
                )

            
            # STEP 2: DETECTORS
            
            cnn_pred = self._safe_predict_detector(
                self.cnn,
                audio_path,
                session_id=resolved_session_id,
                chunk_index=chunk_index,
            )

            wav2vec2_pred = self._safe_predict_detector(
                self.wav2vec2,
                audio_path,
                session_id=resolved_session_id,
                chunk_index=chunk_index,
            )

            
            # STEP 3: RULE ENGINE (temporal + consistency)
            
            if self.enable_rules:
                rule_result = self.rule_engine.evaluate(
                    waveform=waveform,
                    sample_rate=sample_rate,
                    cnn_pred=cnn_pred,
                    wav2vec2_pred=wav2vec2_pred,
                    session_state=session,
                    session_id=resolved_session_id,
                    chunk_index=chunk_index,
                )
            else:
                rule_result = None

            if rule_result is not None and rule_result.skip:
                with self._lock:
                    session.skipped_chunks += 1
                    session.updated_at_utc = session.updated_at_utc

                fusion = self.ensemble.fuse(
                    cnn_pred=None,
                    wav2vec2_pred=None,
                    rule_score=rule_result.rule_score,
                    rule_votes=rule_result.votes,
                    session_state=session,
                    session_id=resolved_session_id,
                    chunk_index=chunk_index,
                )

                return self._build_base_response(
                    session_id=resolved_session_id,
                    chunk_index=chunk_index,
                    audio_path=str(audio_path),
                    audio_rule=audio_rule,
                    cnn_pred=cnn_pred,
                    wav2vec2_pred=wav2vec2_pred,
                    rule_result=rule_result,
                    fusion_result=fusion,
                    session=session,
                    skipped=True,
                    skip_reason="rule_engine_skip",
                    sample_rate=sample_rate,
                    duration_sec=duration_sec,
                )

            
            # STEP 4: FUSION
            
            fusion = self.ensemble.fuse(
                cnn_pred=cnn_pred,
                wav2vec2_pred=wav2vec2_pred,
                rule_score=rule_result.rule_score if rule_result is not None else 0.0,
                rule_votes=rule_result.votes if rule_result is not None else {},
                session_state=session,
                session_id=resolved_session_id,
                chunk_index=chunk_index,
            )

            
            # STEP 5: SESSION UPDATE
            
            fused_obs = ChunkObservation(
                chunk_index=int(chunk_index or 0),
                fake_prob=float(fusion.fake_prob),
                real_prob=float(fusion.real_prob),
                confidence=float(fusion.confidence),
                label=fusion.label,
                risk=fusion.risk,
                detector="ensemble",
                skipped=bool(fusion.skipped),
                meta={
                    "cnn": _serialize(cnn_pred),
                    "wav2vec2": _serialize(wav2vec2_pred),
                    "rule_result": _serialize(rule_result),
                    "fusion": _serialize(fusion),
                },
            )

            with self._lock:
                session.add_chunk(fused_obs)
                session.add_fused(fusion)

            return self._build_base_response(
                session_id=resolved_session_id,
                chunk_index=chunk_index,
                audio_path=str(audio_path),
                audio_rule=audio_rule,
                cnn_pred=cnn_pred,
                wav2vec2_pred=wav2vec2_pred,
                rule_result=rule_result,
                fusion_result=fusion,
                session=session,
                skipped=False,
                sample_rate=sample_rate,
                duration_sec=duration_sec,
            )

        finally:
            if delete_temp and temp_audio_path is not None:
                try:
                    temp_audio_path.unlink(missing_ok=True)
                except Exception:
                    pass

    # Backward-friendly alias
    infer = predict
    predict_chunk = predict
    process = predict