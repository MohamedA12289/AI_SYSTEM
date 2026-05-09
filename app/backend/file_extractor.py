from __future__ import annotations

from pathlib import Path
from typing import Optional
import json
import mimetypes
import os
import re
import tarfile
import zipfile

from file_tools import resolve_safe_path, get_project_root
from wave1_ingest import (
    classify_extension,
    _read_text_head,
    _extract_pdf_text,
    _extract_docx_text,
    _extract_pptx_text,
    _extract_image_text,
    _ffprobe_metadata,
    _tika_parse,
    summarize_tabular_path,
    MAX_INLINE_TEXT_CHARS,
)

try:
    from bs4 import BeautifulSoup  # type: ignore
    _BS4 = True
except Exception:
    BeautifulSoup = None  # type: ignore
    _BS4 = False

try:
    from ebooklib import epub  # type: ignore
    _EBOOKLIB = True
except Exception:
    epub = None  # type: ignore
    _EBOOKLIB = False

try:
    from striprtf.striprtf import rtf_to_text  # type: ignore
    _STRIPRTF = True
except Exception:
    rtf_to_text = None  # type: ignore
    _STRIPRTF = False

try:
    import yaml  # type: ignore
    _YAML = True
except Exception:
    yaml = None  # type: ignore
    _YAML = False

try:
    import tomllib  # type: ignore
    _TOML = True
except Exception:
    try:
        import tomli as tomllib  # type: ignore
        _TOML = True
    except Exception:
        tomllib = None  # type: ignore
        _TOML = False


DEFAULT_MAX_CHARS = 60000
DEFAULT_MAX_FILES = 200
HTML_EXTENSIONS = {".html", ".htm", ".xhtml"}
EPUB_EXTENSIONS = {".epub"}
RTF_EXTENSIONS = {".rtf"}
JSON_EXTENSIONS = {".json", ".jsonl", ".geojson", ".ipynb"}
YAML_EXTENSIONS = {".yaml", ".yml"}
TOML_EXTENSIONS = {".toml"}
ARCHIVE_LIST_EXTENSIONS = {".zip", ".tar", ".gz", ".tgz", ".bz2", ".7z"}
SKIP_DIRS = {".git", "node_modules", "__pycache__", ".venv", "venv", "dist", "build", ".next", ".cache"}


def _truncate(text: str, limit: int) -> str:
    if not text:
        return ""
    return text if len(text) <= limit else text[:limit] + "\n... [truncated]"


def _extract_html(path: Path, max_chars: int) -> str:
    raw = path.read_bytes()
    try:
        decoded = raw.decode("utf-8", errors="ignore")
    except Exception:
        decoded = ""
    if _BS4:
        try:
            soup = BeautifulSoup(decoded, "html.parser")
            for tag in soup(["script", "style", "noscript"]):
                tag.decompose()
            text = soup.get_text(separator="\n")
            lines = [line.strip() for line in text.splitlines() if line.strip()]
            return _truncate("\n".join(lines), max_chars)
        except Exception:
            pass
    text = re.sub(r"<script[\s\S]*?</script>", " ", decoded, flags=re.IGNORECASE)
    text = re.sub(r"<style[\s\S]*?</style>", " ", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    return _truncate(text, max_chars)


def _extract_epub(path: Path, max_chars: int) -> str:
    if not _EBOOKLIB:
        return ""
    try:
        book = epub.read_epub(str(path))
        parts: list[str] = []
        for item in book.get_items():
            if item.get_type() == 9:  # ITEM_DOCUMENT
                content = item.get_content().decode("utf-8", errors="ignore")
                if _BS4:
                    soup = BeautifulSoup(content, "html.parser")
                    parts.append(soup.get_text(separator="\n"))
                else:
                    parts.append(re.sub(r"<[^>]+>", " ", content))
                if sum(len(p) for p in parts) >= max_chars:
                    break
        return _truncate("\n".join(parts), max_chars)
    except Exception:
        return ""


def _extract_rtf(path: Path, max_chars: int) -> str:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    if _STRIPRTF:
        try:
            return _truncate(rtf_to_text(raw), max_chars)
        except Exception:
            pass
    text = re.sub(r"\\[a-zA-Z]+-?\d* ?", " ", raw)
    text = re.sub(r"[{}]", "", text)
    return _truncate(text.strip(), max_chars)


def _extract_json(path: Path, max_chars: int) -> str:
    try:
        data = json.loads(path.read_text(encoding="utf-8", errors="ignore"))
        return _truncate(json.dumps(data, indent=2, default=str), max_chars)
    except Exception:
        return _truncate(path.read_text(encoding="utf-8", errors="ignore"), max_chars)


def _extract_yaml(path: Path, max_chars: int) -> str:
    raw = path.read_text(encoding="utf-8", errors="ignore")
    if _YAML:
        try:
            data = yaml.safe_load(raw)
            return _truncate(json.dumps(data, indent=2, default=str), max_chars)
        except Exception:
            pass
    return _truncate(raw, max_chars)


def _extract_toml(path: Path, max_chars: int) -> str:
    raw_bytes = path.read_bytes()
    if _TOML:
        try:
            data = tomllib.loads(raw_bytes.decode("utf-8", errors="ignore"))
            return _truncate(json.dumps(data, indent=2, default=str), max_chars)
        except Exception:
            pass
    return _truncate(raw_bytes.decode("utf-8", errors="ignore"), max_chars)


def _extract_archive_listing(path: Path, max_chars: int) -> str:
    ext = path.suffix.lower()
    names: list[str] = []
    try:
        if ext == ".zip":
            with zipfile.ZipFile(path, "r") as zf:
                names = zf.namelist()
        elif ext in {".tar", ".gz", ".tgz", ".bz2"}:
            with tarfile.open(path, "r:*") as tf:
                names = tf.getnames()
    except Exception as exc:
        return f"[archive listing failed: {exc}]"
    listing = "\n".join(names[:500])
    return _truncate(listing, max_chars)


def _extract_tabular(path: Path, max_chars: int) -> str:
    try:
        summary = summarize_tabular_path(path)
        return _truncate(json.dumps({
            "columns": summary.get("columns"),
            "row_count_sampled": summary.get("row_count_sampled"),
            "sheet_names": summary.get("sheet_names"),
            "preview_rows": summary.get("preview_rows", [])[:20],
            "dtypes": summary.get("dtypes"),
        }, indent=2, default=str), max_chars)
    except Exception as exc:
        return f"[tabular parse failed: {exc}]"


def extract_file(path: Path, max_chars: int = DEFAULT_MAX_CHARS) -> dict:
    if not path.exists():
        return {"ok": False, "error": "file does not exist", "path": str(path)}
    if not path.is_file():
        return {"ok": False, "error": "path is not a file", "path": str(path)}

    ext = path.suffix.lower()
    family, _ = classify_extension(path)
    mime_type, _ = mimetypes.guess_type(str(path))
    size = path.stat().st_size
    parser = "unknown"
    text = ""
    metadata: dict = {}

    try:
        if ext == ".pdf":
            parser = "pypdf"
            text = _extract_pdf_text(path)
        elif ext == ".docx":
            parser = "python_docx"
            text = _extract_docx_text(path)
        elif ext == ".pptx":
            parser = "python_pptx"
            text = _extract_pptx_text(path)
        elif ext in HTML_EXTENSIONS:
            parser = "html"
            text = _extract_html(path, max_chars)
        elif ext in EPUB_EXTENSIONS:
            parser = "epub"
            text = _extract_epub(path, max_chars)
        elif ext in RTF_EXTENSIONS:
            parser = "rtf"
            text = _extract_rtf(path, max_chars)
        elif ext in JSON_EXTENSIONS:
            parser = "json"
            text = _extract_json(path, max_chars)
        elif ext in YAML_EXTENSIONS:
            parser = "yaml"
            text = _extract_yaml(path, max_chars)
        elif ext in TOML_EXTENSIONS:
            parser = "toml"
            text = _extract_toml(path, max_chars)
        elif family == "tabular":
            parser = "tabular"
            text = _extract_tabular(path, max_chars)
        elif family == "image":
            parser = "image_ocr"
            text = _extract_image_text(path)
        elif family in {"audio", "video"}:
            parser = "ffprobe"
            metadata["media"] = _ffprobe_metadata(path)
        elif ext in ARCHIVE_LIST_EXTENSIONS:
            parser = "archive_listing"
            text = _extract_archive_listing(path, max_chars)
        elif family == "text":
            parser = "direct_text"
            text = _read_text_head(path)
        else:
            parser = "tika_or_text"
            try:
                tika_text, tika_meta = _tika_parse(path)
                if tika_text:
                    text = tika_text
                    metadata["tika"] = tika_meta
                else:
                    text = path.read_text(encoding="utf-8", errors="ignore")[:MAX_INLINE_TEXT_CHARS]
            except Exception:
                text = path.read_text(encoding="utf-8", errors="ignore")[:MAX_INLINE_TEXT_CHARS]

        text = _truncate(text or "", max_chars)
        return {
            "ok": True,
            "path": str(path),
            "name": path.name,
            "extension": ext,
            "size_bytes": size,
            "mime_type": mime_type,
            "family": family,
            "parser": parser,
            "text": text,
            "char_count": len(text),
            "metadata": metadata,
        }
    except Exception as exc:
        return {
            "ok": False,
            "path": str(path),
            "name": path.name,
            "extension": ext,
            "family": family,
            "parser": parser,
            "error": str(exc)[:500],
        }


def extract_folder(
    root: Path,
    max_files: int = DEFAULT_MAX_FILES,
    max_chars_per_file: int = 8000,
    max_total_chars: int = 200000,
) -> dict:
    if not root.exists() or not root.is_dir():
        return {"ok": False, "error": "folder does not exist", "path": str(root)}

    files_out: list[dict] = []
    total_chars = 0
    indexed = 0
    skipped = 0

    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in SKIP_DIRS and not d.startswith(".")]
        for name in filenames:
            if indexed >= max_files or total_chars >= max_total_chars:
                skipped += 1
                continue
            full = Path(dirpath) / name
            try:
                if full.stat().st_size > 50 * 1024 * 1024:
                    skipped += 1
                    continue
            except Exception:
                skipped += 1
                continue
            result = extract_file(full, max_chars=max_chars_per_file)
            try:
                rel = str(full.relative_to(root)).replace("\\", "/")
            except Exception:
                rel = full.name
            result["relative_path"] = rel
            files_out.append(result)
            total_chars += int(result.get("char_count") or 0)
            indexed += 1

    return {
        "ok": True,
        "root": str(root),
        "files_indexed": indexed,
        "files_skipped": skipped,
        "total_chars": total_chars,
        "files": files_out,
    }


def extract_project_path(
    project_name: str,
    relative_path: str,
    max_chars: int = DEFAULT_MAX_CHARS,
    max_files: int = DEFAULT_MAX_FILES,
) -> dict:
    if relative_path in (None, "", "."):
        target = get_project_root(project_name)
    else:
        target = resolve_safe_path(project_name, relative_path)
    if target.is_dir():
        return extract_folder(target, max_files=max_files, max_chars_per_file=min(max_chars, 8000))
    return extract_file(target, max_chars=max_chars)


def extract_absolute_path(
    absolute_path: str,
    max_chars: int = DEFAULT_MAX_CHARS,
    max_files: int = DEFAULT_MAX_FILES,
) -> dict:
    p = Path(absolute_path).expanduser()
    if not p.is_absolute():
        return {"ok": False, "error": "path must be absolute"}
    if not p.exists():
        return {"ok": False, "error": "path does not exist"}
    if p.is_dir():
        return extract_folder(p, max_files=max_files, max_chars_per_file=min(max_chars, 8000))
    return extract_file(p, max_chars=max_chars)
