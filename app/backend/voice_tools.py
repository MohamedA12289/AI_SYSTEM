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
import importlib.util
import shutil
import tempfile
import threading
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

from config import AI_SYSTEM_BASE_PATH
from process_utils import run_hidden

# --- Paths -----------------------------------------------------------------------
_HERE = Path(os.path.dirname(os.path.abspath(__file__)))
_PROJECT_ROOT = _HERE.parent.parent.parent  # app/backend -> repo root
PIPER_DIR = AI_SYSTEM_BASE_PATH / "models" / "piper"
PIPER_DIR.mkdir(parents=True, exist_ok=True)
VOICE_INDEX_CACHE_PATH = PIPER_DIR / "voices_index.json"
VOICE_INDEX_MAX_AGE_SECONDS = 24 * 60 * 60

# --- Faster-whisper lazy load ---------------------------------------------------
_WHISPER_AVAILABLE = False
_WHISPER_IMPORT_CHECKED = False
_WHISPER_INSTALLED = importlib.util.find_spec("faster_whisper") is not None
_whisper_model = None
_whisper_lock = threading.Lock()
_whisper_model_size: str = "base.en"
WhisperModel = None  # type: ignore


def _load_whisper_module() -> bool:
    global _WHISPER_AVAILABLE, _WHISPER_IMPORT_CHECKED, WhisperModel
    if _WHISPER_IMPORT_CHECKED:
        return _WHISPER_AVAILABLE
    _WHISPER_IMPORT_CHECKED = True
    if not _WHISPER_INSTALLED:
        _WHISPER_AVAILABLE = False
        return False
    try:
        from faster_whisper import WhisperModel as _WhisperModel  # type: ignore
        WhisperModel = _WhisperModel  # type: ignore
        _WHISPER_AVAILABLE = True
    except Exception:
        WhisperModel = None  # type: ignore
        _WHISPER_AVAILABLE = False
    return _WHISPER_AVAILABLE


def is_stt_available() -> bool:
    return _WHISPER_INSTALLED


def _get_whisper(model_size: str = "base.en"):
    global _whisper_model, _whisper_model_size
    if not _load_whisper_module():
        raise RuntimeError("faster-whisper not installed")
    with _whisper_lock:
        if _whisper_model is None or _whisper_model_size != model_size:
            _whisper_model = WhisperModel(model_size, device="cpu", compute_type="int8")
            _whisper_model_size = model_size
        return _whisper_model


def transcribe_path(path: str, model_size: str = "base.en", language: Optional[str] = None) -> Dict[str, Any]:
    if not _load_whisper_module():
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


def _normalized_suffix(value: str | None) -> str:
    suffix = (value or "").strip().lower()
    if not suffix:
        return ""
    if not suffix.startswith("."):
        suffix = "." + suffix
    return suffix


def _guess_audio_suffix(audio_bytes: bytes, filename: str | None = None, suffix: str | None = None) -> str:
    explicit = _normalized_suffix(suffix)
    if explicit:
        return explicit

    name_suffix = _normalized_suffix(Path(filename or "").suffix)
    if name_suffix:
        return name_suffix

    header = audio_bytes[:16]
    if len(header) >= 12 and header[:4] == b"RIFF" and header[8:12] == b"WAVE":
        return ".wav"
    if header.startswith(b"\x1aE\xdf\xa3"):
        return ".webm"
    if header.startswith(b"OggS"):
        return ".ogg"
    if header.startswith(b"ID3") or header[:2] in (b"\xff\xfb", b"\xff\xf3", b"\xff\xf2"):
        return ".mp3"
    if len(header) >= 12 and header[4:8] == b"ftyp":
        return ".m4a"
    return ".wav"


def _ffmpeg_path() -> str | None:
    explicit = os.environ.get("FFMPEG_PATH", "").strip()
    if explicit and Path(explicit).exists():
        return explicit
    return shutil.which("ffmpeg")


def _convert_to_wav_if_needed(path: str, suffix: str) -> tuple[str, bool]:
    if suffix == ".wav":
        return path, False

    ffmpeg = _ffmpeg_path()
    if not ffmpeg:
        raise RuntimeError(f"ffmpeg is required to transcribe {suffix} audio. Install ffmpeg or upload WAV audio.")

    with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as wav_tmp:
        wav_path = wav_tmp.name

    result = run_hidden(
        [ffmpeg, "-y", "-i", path, "-ac", "1", "-ar", "16000", wav_path],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        try:
            os.unlink(wav_path)
        except Exception:
            pass
        detail = (result.stderr or result.stdout or "").strip()[:500]
        raise RuntimeError(f"ffmpeg could not convert audio: {detail}")
    return wav_path, True


def transcribe_bytes(
    audio_bytes: bytes,
    suffix: str | None = None,
    model_size: str = "base.en",
    language: Optional[str] = None,
    filename: str | None = None,
) -> Dict[str, Any]:
    """Transcribe in-memory audio. Writes to a temp file because faster-whisper
    expects a file path or numpy array; file path is the simplest cross-format route.
    """
    detected_suffix = _guess_audio_suffix(audio_bytes, filename=filename, suffix=suffix)
    with tempfile.NamedTemporaryFile(delete=False, suffix=detected_suffix) as tmp:
        tmp.write(audio_bytes)
        tmp_path = tmp.name
    transcribe_target = tmp_path
    converted = False
    try:
        transcribe_target, converted = _convert_to_wav_if_needed(tmp_path, detected_suffix)
        return transcribe_path(transcribe_target, model_size=model_size, language=language)
    finally:
        try:
            os.unlink(tmp_path)
        except Exception:
            pass
        if converted:
            try:
                os.unlink(transcribe_target)
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


def _load_cached_voice_index(max_age_seconds: int | None = VOICE_INDEX_MAX_AGE_SECONDS) -> Dict[str, Any] | None:
    try:
        if not VOICE_INDEX_CACHE_PATH.exists():
            return None
        if max_age_seconds is not None:
            age = time.time() - VOICE_INDEX_CACHE_PATH.stat().st_mtime
            if age > max_age_seconds:
                return None
        data = json.loads(VOICE_INDEX_CACHE_PATH.read_text(encoding="utf-8"))
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _write_cached_voice_index(data: Dict[str, Any]) -> None:
    try:
        PIPER_DIR.mkdir(parents=True, exist_ok=True)
        VOICE_INDEX_CACHE_PATH.write_text(json.dumps(data), encoding="utf-8")
    except Exception:
        pass


def fetch_voice_index(timeout: int = 3, refresh: bool = False) -> Dict[str, Any]:
    """Download the upstream voices.json catalog. Returns the raw mapping."""
    if not refresh:
        cached = _load_cached_voice_index()
        if cached is not None:
            return cached

    import urllib.request
    req = urllib.request.Request(PIPER_VOICES_INDEX_URL, headers={"User-Agent": "CubOS"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            raw = resp.read()
        data = json.loads(raw.decode("utf-8"))
        if isinstance(data, dict):
            _write_cached_voice_index(data)
            return data
    except Exception:
        stale = _load_cached_voice_index(max_age_seconds=None)
        if stale is not None:
            return stale
    return {}


def list_available_voices(timeout: int = 3, refresh: bool = False) -> List[Dict[str, Any]]:
    """Return a flat list of installable voices (name + files + lang)."""
    idx = fetch_voice_index(timeout=timeout, refresh=refresh)
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
    if not meta:
        idx = fetch_voice_index(timeout=20, refresh=True)
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
        return {"available": is_stt_available()}
    if op == "transcribe":
        path = args.get("path")
        if not path:
            raise ValueError("transcribe requires 'path'")
        return transcribe_path(path, model_size=args.get("model_size", "base.en"), language=args.get("language"))
    if op == "voices_installed":
        return {"voices": list_installed_voices(), "dir": str(PIPER_DIR)}
    if op == "voices_available":
        return {"voices": list_available_voices(timeout=int(args.get("timeout", 3)), refresh=bool(args.get("refresh", False)))}
    if op == "voice_download":
        key = args.get("key")
        if not key:
            raise ValueError("voice_download requires 'key'")
        return download_voice(key, timeout=int(args.get("timeout", 120)))
    raise ValueError(f"Unknown voice op: {op!r}")
