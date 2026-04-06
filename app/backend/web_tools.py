import ipaddress
import json
import re
from html import unescape
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen

from config import (
    DEFAULT_WEB_TIMEOUT_SECONDS,
    MAX_WEB_TIMEOUT_SECONDS,
    MAX_WEB_FETCH_BYTES,
    MAX_WEB_TEXT_CHARS,
    TAVILY_API_KEY,
    TAVILY_SEARCH_URL,
    DEFAULT_WEB_SEARCH_TIMEOUT_SECONDS,
    MAX_WEB_SEARCH_TIMEOUT_SECONDS,
    DEFAULT_WEB_SEARCH_MAX_RESULTS,
    MAX_WEB_SEARCH_MAX_RESULTS,
    DEFAULT_WEB_SEARCH_TOPIC,
    DEFAULT_WEB_SEARCH_DEPTH,
    ALLOWED_WEB_SEARCH_TOPICS,
    ALLOWED_WEB_SEARCH_DEPTHS,
    ALLOWED_WEB_SEARCH_TIME_RANGES,
)

class HTMLTextExtractor(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []
        self.skip_depth = 0

    def handle_starttag(self, tag, attrs):
        if tag.lower() in {"script", "style", "noscript", "svg"}:
            self.skip_depth += 1

    def handle_endtag(self, tag):
        if tag.lower() in {"script", "style", "noscript", "svg"} and self.skip_depth > 0:
            self.skip_depth -= 1

    def handle_data(self, data):
        if self.skip_depth == 0:
            cleaned = data.strip()
            if cleaned:
                self.parts.append(cleaned)

    def get_text(self) -> str:
        joined = " ".join(self.parts)
        return normalize_whitespace(joined)

def normalize_whitespace(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()

def normalize_timeout(timeout_seconds) -> int:
    if timeout_seconds is None:
        return DEFAULT_WEB_TIMEOUT_SECONDS

    try:
        timeout_value = int(timeout_seconds)
    except (TypeError, ValueError):
        raise ValueError("timeout_seconds must be a valid integer.")

    if timeout_value <= 0:
        raise ValueError("timeout_seconds must be greater than 0.")

    if timeout_value > MAX_WEB_TIMEOUT_SECONDS:
        raise ValueError(
            f"timeout_seconds cannot be greater than {MAX_WEB_TIMEOUT_SECONDS}."
        )

    return timeout_value

def normalize_search_timeout(timeout_seconds) -> int:
    if timeout_seconds is None:
        return DEFAULT_WEB_SEARCH_TIMEOUT_SECONDS

    try:
        timeout_value = int(timeout_seconds)
    except (TypeError, ValueError):
        raise ValueError("timeout_seconds must be a valid integer.")

    if timeout_value <= 0:
        raise ValueError("timeout_seconds must be greater than 0.")

    if timeout_value > MAX_WEB_SEARCH_TIMEOUT_SECONDS:
        raise ValueError(
            f"timeout_seconds cannot be greater than {MAX_WEB_SEARCH_TIMEOUT_SECONDS}."
        )

    return timeout_value

def validate_url(url: str) -> str:
    if not isinstance(url, str):
        raise ValueError("URL must be a string.")

    cleaned = url.strip()
    if not cleaned:
        raise ValueError("URL cannot be empty.")

    parsed = urlparse(cleaned)

    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only http and https URLs are allowed.")

    if not parsed.netloc:
        raise ValueError("URL must include a valid domain.")

    if parsed.username or parsed.password:
        raise ValueError("URLs with embedded credentials are not allowed.")

    hostname = (parsed.hostname or "").strip().lower()
    if not hostname:
        raise ValueError("URL hostname is invalid.")

    if hostname in {"localhost", "127.0.0.1", "0.0.0.0", "::1"}:
        raise ValueError("Localhost URLs are not allowed.")

    if hostname.endswith(".local"):
        raise ValueError("Local network URLs are not allowed.")

    ip = None
    try:
        ip = ipaddress.ip_address(hostname)
    except ValueError:
        ip = None

    if ip is not None:
        if (
            ip.is_private
            or ip.is_loopback
            or ip.is_link_local
            or ip.is_multicast
            or ip.is_reserved
            or ip.is_unspecified
        ):
            raise ValueError("Private or local IP URLs are not allowed.")

    return cleaned

def decode_bytes(raw_bytes: bytes, charset: str | None) -> str:
    if charset:
        try:
            return raw_bytes.decode(charset, errors="replace")
        except LookupError:
            pass

    try:
        return raw_bytes.decode("utf-8", errors="replace")
    except Exception:
        return raw_bytes.decode("latin-1", errors="replace")

def extract_title(html_text: str) -> str:
    match = re.search(r"<title[^>]*>(.*?)</title>", html_text, re.IGNORECASE | re.DOTALL)
    if not match:
        return ""

    title = unescape(match.group(1))
    return normalize_whitespace(title)

def extract_text_from_html(html_text: str) -> str:
    parser = HTMLTextExtractor()
    parser.feed(html_text)
    parser.close()
    return parser.get_text()

def trim_text_content(text: str) -> tuple[str, bool]:
    if len(text) > MAX_WEB_TEXT_CHARS:
        return text[:MAX_WEB_TEXT_CHARS] + "\n\n[truncated]", True
    return text, False

def fetch_url_content(url: str, timeout_seconds=None) -> dict:
    normalized_url = validate_url(url)
    timeout_value = normalize_timeout(timeout_seconds)

    request = Request(
        normalized_url,
        headers={
            "User-Agent": "Mozilla/5.0 (compatible; LocalAIAgent/1.0)"
        },
    )

    try:
        with urlopen(request, timeout=timeout_value) as response:
            final_url = response.geturl()
            content_type = response.headers.get("Content-Type", "")
            charset = None
            if hasattr(response.headers, "get_content_charset"):
                charset = response.headers.get_content_charset()

            raw_bytes = response.read(MAX_WEB_FETCH_BYTES + 1)
            byte_truncated = len(raw_bytes) > MAX_WEB_FETCH_BYTES
            if byte_truncated:
                raw_bytes = raw_bytes[:MAX_WEB_FETCH_BYTES]

            status_code = getattr(response, "status", 200)

    except HTTPError as e:
        raise ValueError(f"HTTP error {e.code} while fetching URL.")
    except URLError as e:
        raise ValueError(f"Could not fetch URL: {e.reason}")
    except Exception as e:
        raise ValueError(f"Could not fetch URL: {str(e)}")

    validate_url(final_url)

    text = decode_bytes(raw_bytes, charset)
    content_type_lower = content_type.lower()

    title = ""
    if "html" in content_type_lower or "<html" in text[:1000].lower():
        title = extract_title(text)
        extracted_text = extract_text_from_html(text)
    else:
        extracted_text = text

    extracted_text, text_truncated = trim_text_content(extracted_text)

    return {
        "url": normalized_url,
        "final_url": final_url,
        "status_code": status_code,
        "content_type": content_type,
        "title": title,
        "text_content": extracted_text,
        "byte_truncated": byte_truncated,
        "text_truncated": text_truncated,
    }

def validate_search_query(query: str) -> str:
    if not isinstance(query, str):
        raise ValueError("Search query must be a string.")

    cleaned = normalize_whitespace(query)
    if not cleaned:
        raise ValueError("Search query cannot be empty.")

    if len(cleaned) > 500:
        raise ValueError("Search query is too long.")

    return cleaned

def normalize_search_topic(topic) -> str:
    if topic is None:
        return DEFAULT_WEB_SEARCH_TOPIC

    cleaned = str(topic).strip().lower()
    if not cleaned:
        return DEFAULT_WEB_SEARCH_TOPIC

    if cleaned not in ALLOWED_WEB_SEARCH_TOPICS:
        raise ValueError(
            f"Invalid search topic. Allowed topics: {sorted(ALLOWED_WEB_SEARCH_TOPICS)}"
        )

    return cleaned

def normalize_search_depth(search_depth) -> str:
    if search_depth is None:
        return DEFAULT_WEB_SEARCH_DEPTH

    cleaned = str(search_depth).strip().lower()
    if not cleaned:
        return DEFAULT_WEB_SEARCH_DEPTH

    if cleaned not in ALLOWED_WEB_SEARCH_DEPTHS:
        raise ValueError(
            f"Invalid search_depth. Allowed values: {sorted(ALLOWED_WEB_SEARCH_DEPTHS)}"
        )

    return cleaned

def normalize_search_max_results(max_results) -> int:
    if max_results is None:
        return DEFAULT_WEB_SEARCH_MAX_RESULTS

    try:
        value = int(max_results)
    except (TypeError, ValueError):
        raise ValueError("max_results must be a valid integer.")

    if value <= 0:
        raise ValueError("max_results must be greater than 0.")

    if value > MAX_WEB_SEARCH_MAX_RESULTS:
        raise ValueError(
            f"max_results cannot be greater than {MAX_WEB_SEARCH_MAX_RESULTS}."
        )

    return value

def normalize_search_time_range(time_range) -> str | None:
    if time_range is None:
        return None

    cleaned = str(time_range).strip().lower()
    if not cleaned:
        return None

    if cleaned not in ALLOWED_WEB_SEARCH_TIME_RANGES:
        raise ValueError(
            f"Invalid time_range. Allowed values: {sorted(ALLOWED_WEB_SEARCH_TIME_RANGES)}"
        )

    return cleaned

def require_tavily_api_key() -> str:
    if not TAVILY_API_KEY:
        raise ValueError("TAVILY_API_KEY is missing.")
    return TAVILY_API_KEY

def trim_search_result_text(text: str, limit: int = 1200) -> str:
    if not isinstance(text, str):
        text = str(text)
    text = normalize_whitespace(text)
    if len(text) > limit:
        return text[:limit] + " [truncated]"
    return text

def search_web(
    query: str,
    topic: str = DEFAULT_WEB_SEARCH_TOPIC,
    max_results: int = DEFAULT_WEB_SEARCH_MAX_RESULTS,
    search_depth: str = DEFAULT_WEB_SEARCH_DEPTH,
    time_range: str | None = None,
    timeout_seconds=None,
) -> dict:
    api_key = require_tavily_api_key()
    normalized_query = validate_search_query(query)
    normalized_topic = normalize_search_topic(topic)
    normalized_max_results = normalize_search_max_results(max_results)
    normalized_search_depth = normalize_search_depth(search_depth)
    normalized_time_range = normalize_search_time_range(time_range)
    timeout_value = normalize_search_timeout(timeout_seconds)

    payload = {
        "query": normalized_query,
        "topic": normalized_topic,
        "max_results": normalized_max_results,
        "search_depth": normalized_search_depth,
        "include_answer": False,
        "include_raw_content": False,
        "include_images": False,
        "include_favicon": False,
    }

    if normalized_time_range:
        payload["time_range"] = normalized_time_range

    request = Request(
        TAVILY_SEARCH_URL,
        data=json.dumps(payload).encode("utf-8"),
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0 (compatible; LocalAIAgent/1.0)",
        },
        method="POST",
    )

    try:
        with urlopen(request, timeout=timeout_value) as response:
            raw_bytes = response.read()
            charset = None
            if hasattr(response.headers, "get_content_charset"):
                charset = response.headers.get_content_charset()
            response_text = decode_bytes(raw_bytes, charset)
            status_code = getattr(response, "status", 200)
    except HTTPError as e:
        error_body = ""
        try:
            error_body = decode_bytes(e.read(), None)
        except Exception:
            error_body = ""
        detail = normalize_whitespace(error_body)[:500]
        if detail:
            raise ValueError(f"Tavily search error {e.code}: {detail}")
        raise ValueError(f"Tavily search error {e.code}.")
    except URLError as e:
        raise ValueError(f"Could not search the web: {e.reason}")
    except Exception as e:
        raise ValueError(f"Could not search the web: {str(e)}")

    try:
        data = json.loads(response_text)
    except json.JSONDecodeError:
        raise ValueError("Tavily returned invalid JSON.")

    raw_results = data.get("results", [])
    cleaned_results = []

    if isinstance(raw_results, list):
        for item in raw_results:
            if not isinstance(item, dict):
                continue

            cleaned_results.append({
                "title": str(item.get("title", "")).strip(),
                "url": str(item.get("url", "")).strip(),
                "content": trim_search_result_text(item.get("content", "")),
                "score": item.get("score"),
                "favicon": item.get("favicon"),
            })

    usage = data.get("usage", {})
    auto_parameters = data.get("auto_parameters", {})

    return {
        "query": normalized_query,
        "topic": normalized_topic,
        "search_depth": normalized_search_depth,
        "max_results": normalized_max_results,
        "time_range": normalized_time_range,
        "status_code": status_code,
        "results": cleaned_results,
        "response_time": data.get("response_time"),
        "request_id": data.get("request_id"),
        "credits_used": usage.get("credits") if isinstance(usage, dict) else None,
        "auto_parameters": auto_parameters if isinstance(auto_parameters, dict) else {},
    }