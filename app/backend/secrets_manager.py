from __future__ import annotations

from collections import OrderedDict

from config import ENV_FILE_PATH, SECRETS_BASE_PATH

MASK_CHAR = "*"


def _read_lines() -> list[str]:
    if not ENV_FILE_PATH.exists():
        return []
    try:
        return ENV_FILE_PATH.read_text(encoding="utf-8").splitlines()
    except Exception:
        return []


def _parse_env(lines: list[str]) -> OrderedDict:
    data = OrderedDict()
    for raw_line in lines:
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if ((value.startswith('"') and value.endswith('"')) or (value.startswith("'") and value.endswith("'"))):
            value = value[1:-1]
        if key:
            data[key] = value
    return data


def _write_env(data: OrderedDict) -> None:
    SECRETS_BASE_PATH.mkdir(parents=True, exist_ok=True)
    lines = [f'{key}="{value}"' for key, value in data.items()]
    ENV_FILE_PATH.write_text("\n".join(lines) + ("\n" if lines else ""), encoding="utf-8")


def _mask_value(value: str) -> str:
    return MASK_CHAR * max(8, min(len(value), 16))


def list_secrets(masked: bool = True) -> dict:
    data = _parse_env(_read_lines())
    items = []
    for key, value in data.items():
        display = value if not masked else _mask_value(value)
        items.append({"key": key, "value": display})
    return {"items": items}


def get_secret(key: str, reveal: bool = False) -> dict:
    data = _parse_env(_read_lines())
    if key not in data:
        raise FileNotFoundError("Secret not found.")
    value = data[key]
    return {"key": key, "value": value if reveal else _mask_value(value)}


def set_secret(key: str, value: str) -> dict:
    key = str(key or "").strip()
    if not key:
        raise ValueError("Secret key cannot be empty.")
    if any(x in key for x in [" ", "\t", "=", ":"]):
        raise ValueError("Secret key contains invalid characters.")
    data = _parse_env(_read_lines())
    data[key] = str(value or "")
    _write_env(data)
    return {"key": key, "updated": True}


def delete_secret(key: str) -> dict:
    data = _parse_env(_read_lines())
    if key not in data:
        raise FileNotFoundError("Secret not found.")
    del data[key]
    _write_env(data)
    return {"key": key, "deleted": True}
