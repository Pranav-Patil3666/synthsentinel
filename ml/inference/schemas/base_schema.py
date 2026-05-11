from __future__ import annotations

from dataclasses import asdict, is_dataclass
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, Iterable


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def clamp_probability(value: Any, default: float = 0.0) -> float:
    try:
        v = float(value)
    except (TypeError, ValueError):
        v = default
    if v != v:  # NaN check
        v = default
    return max(0.0, min(1.0, v))


def enum_value(value: Any) -> Any:
    return value.value if isinstance(value, Enum) else value


def to_serializable(obj: Any) -> Any:
    if is_dataclass(obj) and not isinstance(obj, type):  # excludes dataclass types/classes
        return {k: to_serializable(v) for k, v in asdict(obj).items()}
    if isinstance(obj, Enum):
        return obj.value
    if isinstance(obj, dict):
        return {str(k): to_serializable(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, set)):
        return [to_serializable(v) for v in obj]
    return obj


def normalize_string(value: Any, default: str = "") -> str:
    if value is None:
        return default
    return str(value).strip()


def as_list(values: Iterable[Any]) -> list[Any]:
    return [to_serializable(v) for v in values]