from __future__ import annotations

import shutil
import sys
import tempfile
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware


# Make `ml/` importable so we can reach `inference/`

BASE_DIR = Path(__file__).resolve().parents[1]
if str(BASE_DIR) not in sys.path:
    sys.path.insert(0, str(BASE_DIR))

from inference.inference_service import InferenceService  # noqa: E402  #type: ignore

app = FastAPI(title="SynthSentinel Inference API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten later if needed
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Warm, frozen inference service
# Uses fixed thresholds from config only.

INFERENCE_SERVICE = InferenceService(enable_rules=True)


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "SynthSentinel inference",
        "snapshot": INFERENCE_SERVICE.session_name,
    }


@app.post("/infer")
async def infer(
    file: UploadFile = File(...),
    session_id: Optional[str] = Form(default=None),
    call_id: Optional[str] = Form(default=None),
    chunk_index: Optional[int] = Form(default=None),
):
    temp_path: Optional[Path] = None

    try:
        suffix = Path(file.filename or "chunk.wav").suffix
        if not suffix:
            suffix = ".wav"

        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            temp_path = Path(tmp.name)
            shutil.copyfileobj(file.file, tmp)

        result = INFERENCE_SERVICE.predict(
            audio_path=temp_path,
            session_id=session_id,
            call_id=call_id,
            chunk_index=chunk_index,
        )

        # Echo request context so the backend can preserve orchestration metadata
        result["call_id"] = call_id
        result["request"] = {
            "session_id": session_id,
            "call_id": call_id,
            "chunk_index": chunk_index,
            "filename": file.filename,
        }

        return result

    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))

    finally:
        try:
            if temp_path is not None and temp_path.exists():
                temp_path.unlink()
        except Exception:
            pass