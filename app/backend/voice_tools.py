"""Voice tools — STT (faster-whisper) + Piper TTS voice picker.

Why a separate module from ``media_tools``?
  * ``media_tools`` uses the original ``openai-whisper`` reference impl,
    which is slow and heavy. ``faster-whisper`` is 4x faster and is the
    chat-mode microphone path.
  * Voice picker management belongs here too (per IMPLEMENTATION_PLAN 3.1).
"""
from __future__ import annotations

import json
import os
import threading
from pathlib import Path
from typing import Any, Dict, List, Optional

# --- Paths -----------------------------------------------------------------------
_HERE = Path(os.path.dirname(os.path.abspath(__file__)))
_PROJECT_ROOT = _HERE.parent.parent  # app/backend -> app -> repo root
PIPER_DIR = _PROJECT_ROOT / "models" / "piper"
PIPER_DIR.mkdir(parents=True, exist_ok=True)

# --- Faster-whisper lazy load ---------------------------------------------------
_WHISPER_AVAILABLE = False
_whisper_model = None
_whisper_lock = threading.Lock()
_whisper_model_size: str = "base.en"

try:
    from faster_whisper import WhisperModel  # type: ignore
    _WHISPER_AVAILABLE = True
except Exception:
    WhisperModel = None  # type: ignore


def is_stt_available() -> bool:
    return _WHISPER_AVAILABLE


def _get_whisper(model_size: str = "base.en"):
    global _whisper_model, _whisper_model_size
    if not _WHISPER_AVAILABLE:
        raise RuntimeError("faster-whisper not installed")
    with _whisper_lock:
        if _whisper_model is None or _whisper_model_size != model_size:
            _whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
            _whisper_model_size = model_size
        return _whisper_model


def transcribe_path(path: str, model_size: str = "base.en", language: Optional[str] = None) -> Dict[str, Any]:
    if not _WHISPER_AVAILABLE:
        raise RuntimeError("faster-whisper not installed")
    if not os.path.isfile(path):
        raise FileNotFoundError(path)
    model = _get_whisper(model_size)
    segments, info = model.transcribe(path, language=language, vad_filter=True)
    seg_list = []
    full_text_parts = []
    for s in segments:
        text = (s.text or "").strip()
        seg_list.append({"start": float(s.start), "end": float(s.end), "text": text})
        full_text_parts.append(text)
    return {
        "text": " ".join(full_text_parts).strip(),
        "language": getattr(info, "language", language) or "",
        "duration": float(getattr(info, "duration", 0.0) or 0.0),
        "segments": seg_list,
        "model": model_size,
    }


def transcribe_bytes(audio_bytes: bytes, suffix: str = ".wav", model_size: str = "base.en", language: Optional[str] = None) -> Dict[str, Any]:
    """Transcribe in-memory audio. Writes to a temp file because faster-whisper
    expects a file path or numpy array; file path is the simplest cross-format route.
    """
    import tempfile
    with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    try:
        return transcribe_path(tmp_path, model_size=model_size, language=language)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass


# --- Piper voice picker ---------------------------------------------------------
PIPER_VOICES_INDEX_URL = (
    "https://huggingface.co/rhasspy/piper-voices/resolve/main/voices.json"
)
PIPER_VOICE_BASE = "https://huggingface.co/rhasspy/piper-voices/resolve/main/"


def list_installed_voices() -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not PIPER_DIR.is_dir():
        return out
    for f in sorted(PIPER_DIR.glob("*.onnx")):
        cfg = f.with_suffix(".onnx.json")
        out.append({
            "name": f.stem,
            "onnx_path": str(f),
            "config_path": str(cfg) if cfg.exists() else None,
            "size_mb": round(f.stat().st_size / (1024 * 1024), 1),
            "ready": cfg.exists(),
        })
    return out


def fetch_voice_index(timeout: int = 20) -> Dict[str, Any]:
    """Download the upstream voices.json catalog. Returns the raw mapping."""
    import urllib.request
    req = urllib.request.Request(PIPER_VOICES_INDEX_URL, headers={"User-Agent": "CubOS"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = resp.read()
    return json.loads(data.decode("utf-8"))


def list_available_voices(timeout: int = 20) -> List[Dict[str, Any]]:
    """Return a flat list of installable voices (name + files + lang)."""
    idx = fetch_voice_index(timeout=timeout)
    out: List[Dict[str, Any]] = []
    if not isinstance(idx, dict):
        return out
    for key, meta in idx.items():
        if not isinstance(meta, dict):
            continue
        files = meta.get("files") or {}
        out.append({
            "key": key,
            "name": meta.get("name") or key,
            "language": (meta.get("language") or {}).get("code") or meta.get("language_code") or "",
            "quality": meta.get("quality") or "",
            "files": list(files.keys()),
        })
    out.sort(key=lambda v: (v["language"], v["key"]))
    return out


def download_voice(voice_key: str, timeout: int = 120) -> Dict[str, Any]:
    """Download .onnx + .onnx.json for a given voice key. Saves them under
    PIPER_DIR using only the basename (e.g. en_US-amy-medium.onnx)."""
    import urllib.request
    idx = fetch_voice_index(timeout=20)
    meta = idx.get(voice_key)
    if not meta or not isinstance(meta, dict):
        raise ValueError(f"Unknown voice key: {voice_key!r}")
    files = meta.get("files") or {}
    if not files:
        raise ValueError(f"No files listed for voice {voice_key}")
    saved: List[str] = []
    for rel_path in files.keys():
        if not (rel_path.endswith(".onnx") or rel_path.endswith(".onnx.json")):
            continue
        url = PIPER_VOICE_BASE + rel_path
        dest = PIPER_DIR / Path(rel_path).name
        req = urllib.request.Request(url, headers={"User-Agent": "CubOS"})
        with urllib.request.urlopen(req, timeout=timeout) as resp, open(dest, "wb") as out:
            while True:
                chunk = resp.read(64 * 1024)
                if not chunk:
                    break
                out.write(chunk)
        saved.append(str(dest))
    return {"voice": voice_key, "saved": saved, "dir": str(PIPER_DIR)}


def run_voice_op(project_name: str, op: str, args: dict) -> Dict[str, Any]:
    op = (op or "").strip().lower()
    if op == "stt_available":
        return {"available": _WHISPER_AVAILABLE}
    if op == "transcribe":
        path = args.get("path")
        if not path:
            raise ValueError("transcribe requires 'path'")
        return transcribe_path(path, model_size=args.get("model_size", "base.en"), language=args.get("language"))
    if op == "voices_installed":
        return {"voices": list_installed_voices(), "dir": str(PIPER_DIR)}
    if op == "voices_available":
        return {"voices": list_available_voices(timeout=int(args.get("timeout", 20)))}
    if op == "voice_download":
        key = args.get("key")
        if not key:
            raise ValueError("voice_download requires 'key'")
        return download_voice(key, timeout=int(args.get("timeout", 120)))
    raise ValueError(f"Unknown voice op: {op!r}")
