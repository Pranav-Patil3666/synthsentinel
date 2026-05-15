# SynthSentinel

**SynthSentinel** is a production-grade, real-time voice forensics system engineered for detecting synthetic, spoofed, and adversarially manipulated speech in live audio streams. It combines a **spectrogram-domain CNN** for frequency-artifact analysis, a **multilingual XLSR-Wav2Vec2** model for raw-waveform phonetic reasoning, and a **deterministic rule engine** for temporal forensic logic — fused through a calibrated ensemble that produces session-aware fraud risk scores at inference time.

---

## Core Objective

SynthSentinel is designed to flag suspicious speech within the **first few seconds of a call or audio session**, and escalate risk dynamically as repeated anomalies accumulate across streaming chunks. The system is purpose-built for:

- live VoIP / SIP / Twilio call monitoring
- real-time synthetic voice and TTS detection
- voice cloning and replay attack identification
- multilingual speaker analysis under noisy, compressed audio
- low-latency streaming inference with session-level memory

---

## High-Level Architecture

```
Call Ingress (Twilio / SIP / VoIP)
          ↓
Real-Time Backend Orchestration (FastAPI + WebSockets)
          ↓
┌─────────────────────────────────────┐
│          Inference Layer            │
│  ├─ CNN Branch (mel-spectrogram)    │
│  ├─ Wav2Vec2 Branch (raw waveform)  │
│  └─ Rule Engine (deterministic DSP) │
└─────────────────────────────────────┘
          ↓
Ensemble Fusion + Calibrated Risk Engine
          ↓
Dashboard / Persistent Storage / Real-Time Alerts
```

---

## System Design

SynthSentinel is decomposed into three cleanly separated layers with well-defined contracts between them.

### 1. Streaming & Backend Layer

Handles all live audio ingestion and session orchestration:

- **WebSocket server** for continuous low-latency audio chunk delivery
- **VAD (Voice Activity Detection)** via `webrtcvad` for silence rejection before inference
- **Overlapping window segmentation** to ensure no speech boundary is missed between chunks
- **Session-aware chunk sequencing** to maintain per-call state across the inference lifecycle
- **FastAPI** as the async API backbone for inference routing and event emission

### 2. ML Inference Layer

The core detection stack, composed of three independent subsystems:

**CNN Branch**
Operates on fixed-length **mel-spectrogram** representations of audio chunks. Targets:
- vocoder-specific spectral artifacts
- GAN-based synthesis smoothness anomalies
- codec compression fingerprints
- frequency-domain irregularities characteristic of modern TTS engines

**Wav2Vec2 Branch**
Fine-tuned **multilingual XLSR-Wav2Vec2** backbone for binary classification on raw waveform input. Captures:
- phoneme-level temporal inconsistency
- acoustic boundary discontinuities
- multilingual speaker variation patterns
- speech-level representations beyond spectrogram features

**Rule Engine**
Deterministic forensic logic operating on stream-level signals:
- silence ratio and low-energy chunk flagging
- clipping and saturation anomalies
- cross-model detector disagreement scoring
- fake-streak persistence across sliding windows
- confidence spike detection and instability penalties
- session-level behavioral consistency checks

### 3. Output / Decision Layer

Every inference cycle emits:
- Binary label: `REAL` / `FAKE`
- Calibrated confidence score
- Risk tier: `LOW` / `MEDIUM` / `HIGH`
- Per-chunk and per-session explanations
- Alerting-ready structured output for dashboard or storage ingestion

---

## Why This Architecture

Single-model approaches are brittle in production voice forensics. Real-world audio introduces:
- phone codec compression (G.711, G.729, Opus)
- background noise and acoustic room effects
- unseen TTS engines and voice cloning systems
- replay attack artifacts
- confidence instability across chunk boundaries

SynthSentinel's **hybrid CNN + Wav2Vec2 + rule engine design** is specifically built to be robust across these failure modes. Each branch provides a different representational perspective:

| Branch | Signal Domain | Strength |
|---|---|---|
| CNN | Frequency (mel-spectrogram) | Spectral artifact detection |
| Wav2Vec2 | Time (raw waveform) | Phonetic / speech-level reasoning |
| Rule Engine | Stream-level DSP signals | Temporal stability + determinism |

The ensemble fuses all three using calibrated weighted logic, balancing false positive control on real speakers against sensitivity to spoofed speech.

---

## ML Subsystems

### CNN Branch

Pipeline:
1. Resample to 16 kHz → mono conversion
2. Fixed-length chunking with overlap
3. Mel-spectrogram extraction (normalized)
4. CNN forward pass → logit → calibrated probability

Trained as a standalone baseline. Evaluated independently before ensemble integration. Strong on vocoder and GAN artifact detection.

### Wav2Vec2 Branch

Pipeline:
1. Resample to 16 kHz → mono waveform
2. Fixed-duration waveform window extraction
3. XLSR-Wav2Vec2 feature extraction (raw waveform → contextualized speech representations)
4. Classification head → binary output

Fine-tuned for binary spoof detection. Particularly effective on seen and unseen TTS engines due to pre-training on multilingual speech at scale.

### Rule Engine

Not a heuristic layer — a **deterministic forensic subsystem** that adds:
- interpretability to ensemble decisions
- resilience against edge cases where ML confidence is unreliable
- session-level behavioral memory that pure ML lacks

### Ensemble Fusion

Final decision flow:
1. CNN score + Wav2Vec2 score → calibrated weighted combination
2. Rule engine adjustments applied as delta modifiers
3. Session-level risk accumulated across chunk history
4. Final risk tier emitted with structured explanation

---

## Data Pipeline

SynthSentinel was trained on a **leakage-controlled, multi-source dataset** with strict train / validation / test splits:

| Source | Type |
|---|---|
| Real speech recordings | Genuine speech baseline |
| YouTube interviews | Diverse real-world audio |
| Common Voice Hindi | Multilingual real speech |
| ASVspoof-style samples | Standardized spoof benchmark |
| Synthetic TTS samples | Modern neural TTS (seen engines) |
| Augmented fake samples | Compression + noise augmentation |

All sources normalized to consistent format before preprocessing. No data leakage across splits.

---

## Preprocessing Strategy

| Stage | CNN | Wav2Vec2 | Streaming |
|---|---|---|---|
| Sample rate | 16 kHz | 16 kHz | 16 kHz |
| Channel | Mono | Mono | Mono |
| Chunking | Fixed-length | Fixed-duration windows | Overlapping + VAD-filtered |
| Feature | Mel-spectrogram | Raw waveform | Session-sequenced chunks |
| Normalization | Per-spectrogram | N/A | N/A |

---

## Evaluation Strategy

SynthSentinel is evaluated beyond raw accuracy — with full emphasis on **security-grade metrics**:

- Confusion matrix analysis
- Precision, Recall, F1-score
- ROC AUC + PR AUC
- Threshold sweep for operating point selection
- Calibration analysis (reliability diagrams)
- Confidence stability across chunk sequences

The system optimizes for **low false alarm rate on real speakers** and **high recall on fake speech** — the correct trade-off for a fraud detection system.

---

## Runtime Inference Loop

At inference time, per audio chunk:

```
1. Receive raw audio chunk over WebSocket
2. Apply VAD → reject silence / low-energy frames
3. Preprocess → mel-spectrogram (CNN) + raw waveform (Wav2Vec2)
4. Parallel forward pass → CNN score + Wav2Vec2 score
5. Rule engine evaluation → DSP-based adjustments
6. Ensemble fusion → calibrated risk score
7. Session state update → accumulate chunk history
8. Emit prediction event → dashboard / storage / alert
```

---

## Project Structure

```
SynthSentinel/
├── backend/          → FastAPI, WebSocket server, streaming orchestration
├── ml/
│   ├── src/          → CNN training, evaluation, preprocessing
│   ├── wav2vec/      → Wav2Vec2 fine-tuning, inference, evaluation
│   ├── inference/    → ensemble, rule engine, detectors, schemas, config
│   ├── models/       → frozen checkpoints and versioned snapshots
│   ├── results/      → evaluation plots, metrics, reports
│   └── outputs/      → baseline artifacts and frozen snapshots

```

---

## Current Status

| Component | Status |
|---|---|
| CNN baseline | ✅ Trained + evaluated |
| Wav2Vec2 baseline | ✅ Trained + evaluated |
| Model snapshots | ✅ Frozen |
| Evaluation reports | ✅ Complete |
| Inference architecture scaffold | ✅ Built |
| Backend streaming foundation | ✅ Built |
| Ensemble integration | 🔄 In progress |
| Rule engine orchestration | 🔄 In progress |
| Session-level risk aggregation | 🔄 Planned |
| Dashboard event streaming | 🔄 Planned |
| Alert generation | 🔄 Planned |

> SynthSentinel is transitioning from model experimentation to **full real-time forensic system integration**.

---

## Roadmap

- [ ] Backend ensemble integration
- [ ] Rule engine orchestration layer
- [ ] Session-level risk aggregation
- [ ] Dashboard event streaming
- [ ] Persistent prediction history storage
- [ ] Alert generation pipeline
- [ ] Hard-fake robustness evaluation (unseen TTS + replay attacks)
- [ ] Latency benchmarking under real call conditions

---

## Design Philosophy

SynthSentinel is built as a **modular forensic detection system**, not a monolithic model. Every design decision prioritizes:

- **Reproducibility** — frozen snapshots, versioned artifacts, controlled evaluation
- **Modularity** — CNN, Wav2Vec2, and rule engine are independently swappable
- **Calibration** — probability outputs are calibrated, not raw logits
- **Session reasoning** — risk accumulates over time, not just per-chunk
- **Deployment readiness** — clean backend/ML separation from day one

---

**SynthSentinel** — hybrid CNN + Wav2Vec2 + rule-based ensemble for real-time synthetic speech detection, streaming risk intelligence, and production voice forensics.