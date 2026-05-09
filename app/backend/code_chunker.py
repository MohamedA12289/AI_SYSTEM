"""Code chunker for repo RAG.

Uses tree-sitter for AST-aware chunking when available; otherwise falls
back to a simple line-based sliding window. Returns a uniform list of
chunk dicts: {path, language, start_line, end_line, kind, name, text}.
"""
from __future__ import annotations

import os
from typing import List, Dict, Optional, Any

# --- Optional tree-sitter setup -------------------------------------------------
_TS_AVAILABLE = False
_get_parser = None
try:
    import tree_sitter  # noqa: F401
    from tree_sitter_languages import get_parser as _get_parser  # type: ignore
    # Smoke-test: some tree_sitter / tree_sitter_languages versions are ABI
    # incompatible and raise when constructing a parser. Verify lazily.
    try:
        _p = _get_parser("python")
        _p.parse(b"x = 1\n")
        _TS_AVAILABLE = True
    except Exception:
        _TS_AVAILABLE = False
        _get_parser = None
except Exception:
    _TS_AVAILABLE = False
    _get_parser = None


EXT_TO_LANG = {
    ".py": "python",
    ".js": "javascript",
    ".jsx": "javascript",
    ".ts": "typescript",
    ".tsx": "tsx",
    ".go": "go",
    ".rs": "rust",
    ".java": "java",
    ".c": "c",
    ".h": "c",
    ".cpp": "cpp",
    ".hpp": "cpp",
    ".cc": "cpp",
    ".cs": "c_sharp",
    ".rb": "ruby",
    ".php": "php",
    ".sh": "bash",
    ".lua": "lua",
}

CHUNK_NODE_TYPES = {
    "python": {"function_definition", "class_definition"},
    "javascript": {"function_declaration", "class_declaration", "method_definition", "arrow_function"},
    "typescript": {"function_declaration", "class_declaration", "method_definition", "interface_declaration"},
    "tsx": {"function_declaration", "class_declaration", "method_definition", "interface_declaration"},
    "go": {"function_declaration", "method_declaration", "type_declaration"},
    "rust": {"function_item", "impl_item", "struct_item", "enum_item", "trait_item"},
    "java": {"method_declaration", "class_declaration", "interface_declaration"},
    "c": {"function_definition", "struct_specifier"},
    "cpp": {"function_definition", "class_specifier", "struct_specifier"},
    "c_sharp": {"method_declaration", "class_declaration"},
    "ruby": {"method", "class", "module"},
    "php": {"function_definition", "method_declaration", "class_declaration"},
    "lua": {"function_declaration"},
}


def detect_language(path: str) -> Optional[str]:
    ext = os.path.splitext(path)[1].lower()
    return EXT_TO_LANG.get(ext)


def is_tree_sitter_available() -> bool:
    return _TS_AVAILABLE


def _node_name(node, source: bytes) -> str:
    try:
        nm = node.child_by_field_name("name")
        if nm is not None:
            return source[nm.start_byte:nm.end_byte].decode("utf-8", errors="replace")
    except Exception:
        pass
    return ""


def _chunk_with_tree_sitter(path: str, text: str, language: str) -> List[Dict[str, Any]]:
    assert _get_parser is not None
    try:
        parser = _get_parser(language)
    except Exception:
        return _chunk_lines(path, text, language)
    src = text.encode("utf-8", errors="replace")
    try:
        tree = parser.parse(src)
    except Exception:
        return _chunk_lines(path, text, language)

    targets = CHUNK_NODE_TYPES.get(language, set())
    chunks: List[Dict[str, Any]] = []

    def walk(node):
        if node.type in targets:
            start_line = node.start_point[0] + 1
            end_line = node.end_point[0] + 1
            snippet = src[node.start_byte:node.end_byte].decode("utf-8", errors="replace")
            chunks.append({
                "path": path,
                "language": language,
                "start_line": start_line,
                "end_line": end_line,
                "kind": node.type,
                "name": _node_name(node, src),
                "text": snippet,
            })
            # don't descend into chunked nodes for top-level; still walk for nested classes/methods
        for c in node.children:
            walk(c)

    walk(tree.root_node)
    if not chunks:
        return _chunk_lines(path, text, language)
    return chunks


def _chunk_lines(path: str, text: str, language: Optional[str], window: int = 80, overlap: int = 10) -> List[Dict[str, Any]]:
    lines = text.splitlines()
    if not lines:
        return []
    chunks: List[Dict[str, Any]] = []
    step = max(1, window - overlap)
    i = 0
    n = len(lines)
    while i < n:
        j = min(n, i + window)
        snippet = "\n".join(lines[i:j])
        chunks.append({
            "path": path,
            "language": language or "text",
            "start_line": i + 1,
            "end_line": j,
            "kind": "window",
            "name": "",
            "text": snippet,
        })
        if j >= n:
            break
        i += step
    return chunks


def chunk_text(path: str, text: str, language: Optional[str] = None) -> List[Dict[str, Any]]:
    """Chunk a single file's text. Returns list of chunk dicts."""
    lang = language or detect_language(path)
    if _TS_AVAILABLE and lang and lang in CHUNK_NODE_TYPES:
        return _chunk_with_tree_sitter(path, text, lang)
    return _chunk_lines(path, text, lang)


def chunk_file(path: str, max_bytes: int = 2_000_000) -> List[Dict[str, Any]]:
    """Read a file from disk and chunk it. Skips files larger than max_bytes."""
    try:
        size = os.path.getsize(path)
    except OSError:
        return []
    if size > max_bytes:
        return []
    try:
        with open(path, "r", encoding="utf-8", errors="replace") as f:
            text = f.read()
    except Exception:
        return []
    return chunk_text(path, text)
