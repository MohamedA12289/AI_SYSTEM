from pathlib import Path
import shutil
import tempfile
import subprocess

from file_tools import resolve_safe_path
from process_utils import run_hidden

_ALLOWED_AUDIO_EXTENSIONS = {".mp3", ".wav", ".m4a", ".flac", ".aac", ".ogg", ".wma", ".webm"}
_ALLOWED_VIDEO_EXTENSIONS = {".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"}
_MODEL_CACHE: dict[str, object] = {}


def _load_model(model_name: str):
    import whisper  # lazy import — torch/whisper not bundled in packaged build
    clean_name = (model_name or "base").strip() or "base"
    if clean_name not in _MODEL_CACHE:
        _MODEL_CACHE[clean_name] = whisper.load_model(clean_name)
    return _MODEL_CACHE[clean_name]


def _is_audio_or_video(path: Path) -> bool:
    ext = path.suffix.lower()
    return ext in _ALLOWED_AUDIO_EXTENSIONS or ext in _ALLOWED_VIDEO_EXTENSIONS


def _extract_audio_for_transcription(source_path: Path) -> tuple[Path, Path | None]:
    ext = source_path.suffix.lower()
    if ext in _ALLOWED_AUDIO_EXTENSIONS:
        return source_path, None
    if ext not in _ALLOWED_VIDEO_EXTENSIONS:
        raise ValueError("File is not a supported audio or video type.")
    temp_dir = Path(tempfile.mkdtemp(prefix="cubos_media_"))
    output_audio = temp_dir / "extracted_audio.wav"
    result = run_hidden(
        ["ffmpeg", "-y", "-i", str(source_path), "-vn", "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", str(output_audio)],
        capture_output=True,
        text=True,
        shell=False,
        timeout=120,
    )
    if result.returncode != 0 or not output_audio.exists():
        stderr = (result.stderr or "").strip()
        if stderr:
            raise ValueError(f"FFmpeg could not extract audio from the media file. stderr: {stderr}")
        raise ValueError("FFmpeg could not extract audio from the media file.")
    return output_audio, temp_dir


def _transcribe_from_path(target_file: Path, project_name: str, path_label: str, model_name: str = "base", task: str = "transcribe", language: str | None = None) -> dict:
    if not target_file.exists():
        raise FileNotFoundError("Media file does not exist.")
    if target_file.is_dir():
        raise IsADirectoryError("Target path is a directory, not a file.")
    if not _is_audio_or_video(target_file):
        raise ValueError("This file type is not supported for transcription.")
    model = _load_model(model_name)
    audio_path, temp_dir = _extract_audio_for_transcription(target_file)
    try:
        result = model.transcribe(str(audio_path), task=(task or "transcribe"), language=(language or None), fp16=False)
    finally:
        if temp_dir and temp_dir.exists():
            shutil.rmtree(temp_dir, ignore_errors=True)
    segments = [{"start": s.get("start"), "end": s.get("end"), "text": (s.get("text") or "").strip()} for s in result.get("segments", []) or []]
    return {
        "project_name": project_name,
        "path": path_label,
        "model_name": model_name,
        "task": task,
        "language": result.get("language") or language,
        "text": (result.get("text") or "").strip(),
        "segments": segments,
    }


def transcribe_project_media(project_name: str, relative_path: str, model_name: str = "base", task: str = "transcribe", language: str | None = None) -> dict:
    target_file = resolve_safe_path(project_name, relative_path)
    return _transcribe_from_path(target_file, project_name, relative_path, model_name=model_name, task=task, language=language)


def transcribe_media_any_path(project_name: str, source_path: str, model_name: str = "base", task: str = "transcribe", language: str | None = None) -> dict:
    raw = str(source_path or "").strip()
    if not raw:
        raise ValueError("Path cannot be empty.")
    p = Path(raw)
    if p.is_absolute():
        return _transcribe_from_path(p, project_name, raw, model_name=model_name, task=task, language=language)
    return transcribe_project_media(project_name, raw, model_name=model_name, task=task, language=language)
