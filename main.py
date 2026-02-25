from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import shlex
import subprocess
import shutil
import time
import zipfile
from io import BytesIO
from pathlib import Path
import tempfile
from typing import Any
import sys
import io

# ==========================================
# CRITICAL: ASCII ENCODING CRASH FIX
# ==========================================
# Force UTF-8 regardless of host terminal locale to prevent
# UnicodeEncodeError (for example with symbols like '\u25cf').
os.environ["PYTHONIOENCODING"] = "utf-8"
os.environ["PYTHONUTF8"] = "1"
os.environ["LANG"] = "C.UTF-8"
os.environ["LC_ALL"] = "C.UTF-8"

# Re-wrap stdout/stderr with UTF-8 safely when possible.
def _ensure_utf8_stdio() -> None:
    for stream_name in ("stdout", "stderr"):
        stream = getattr(sys, stream_name, None)
        if stream is None:
            continue

        # Prefer reconfigure when available (works for normal TextIO streams).
        reconfigure = getattr(stream, "reconfigure", None)
        if callable(reconfigure):
            try:
                reconfigure(encoding="utf-8", errors="replace")
                continue
            except Exception:
                pass

        encoding = (getattr(stream, "encoding", "") or "").lower()
        if encoding == "utf-8":
            continue
        buffer = getattr(stream, "buffer", None)
        if buffer is None:
            continue
        try:
            setattr(sys, stream_name, io.TextIOWrapper(buffer, encoding="utf-8", errors="replace"))
        except Exception:
            # Keep original stream if wrapping fails in constrained runtimes.
            continue


def _ascii_safe(text: str) -> str:
    # Codex CLI output can contain unicode glyphs; normalize to ASCII for stability
    # in restrictive terminal/runtime environments.
    return text.encode("ascii", "replace").decode("ascii")


_ensure_utf8_stdio()
# ==========================================

import httpx
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

app = FastAPI(title="Universal AI Backend")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"
OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
DEFAULT_REFERER = os.getenv("OPENROUTER_REFERER", "https://universal-ai-ide.local")
DEFAULT_TITLE = os.getenv("OPENROUTER_APP_TITLE", "Universal AI IDE")
MODEL_CACHE_TTL_SECONDS = 300
MODEL_CACHE: dict[str, Any] = {"fetched_at": 0.0, "models": []}
DEPLOYMENTS_DIR = Path(os.getenv("DEPLOYMENTS_DIR", "/tmp/universal-ai-ide-deployments"))
ANSI_ESCAPE_RE = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
ANSI_ORPHAN_RE = re.compile(r"\[[0-9;]*m")
CODEX_VERIFICATION_URL = "https://auth.openai.com/codex/device"
CODEX_CODE_TTL_SECONDS = 600
CODEX_MIN_RETRY_SECONDS = 5
CODEX_DEVICE_CODE_RE = re.compile(r"\b([A-Z0-9]{4})[^A-Z0-9\r\n]{0,3}([A-Z0-9]{5})\b")
CODEX_DEVICE_CODE_SPLIT_RE = re.compile(r"\b([A-Z0-9](?:[^A-Z0-9\r\n]+[A-Z0-9]){8})\b")
CODEX_VERIFICATION_URL_RE = re.compile(r"https://auth\.openai\.com/codex/device")
CODEX_AUTH_COMMAND_CANDIDATES: list[list[str]] = [
    ["codex", "login", "--device-auth"],
    ["codex", "login"],
]
CODEX_AUTH_STATE: dict[str, Any] = {
    "authenticated": False,
    "message": "Not authenticated.",
    "code": None,
    "verification_url": CODEX_VERIFICATION_URL,
    "code_expires_at": 0.0,
    "next_start_allowed_at": 0.0,
}

class ChatAttachment(BaseModel):
    name: str = Field(min_length=1)
    mime_type: str = Field(min_length=1)
    data_base64: str = Field(min_length=1)

class ChatPayload(BaseModel):
    message: str = Field(min_length=1)
    vfs: dict[str, str]
    model: str = Field(min_length=1)
    model_provider: str | None = None
    api_key: str | None = None
    system_prompt: str | None = None
    attachments: list[ChatAttachment] = Field(default_factory=list)


class RecommendPayload(BaseModel):
    message: str = Field(min_length=1)
    candidates: list[str] = Field(default_factory=list)
    api_key: str | None = None

def build_system_prompt(vfs: dict[str, str], custom_system_prompt: str | None = None) -> str:
    base_prompt = (
        "You are an expert Senior Web Developer. "
        "The user is working in a multi-file web IDE. "
        "Always return complete file replacements in markdown fenced blocks where the fence label is the filename."
    )
    if custom_system_prompt:
        base_prompt = f"{base_prompt}\n\nUser system prompt:\n{custom_system_prompt.strip()}"
    return f"{base_prompt}\n\nCurrent project files:\n{json.dumps(vfs, indent=2)}"

def build_user_message(payload: ChatPayload) -> str | list[dict[str, Any]]:
    if not payload.attachments:
        return payload.message
    content: list[dict[str, Any]] = [{"type": "text", "text": payload.message}]
    for attachment in payload.attachments:
        if attachment.mime_type.startswith("image/"):
            content.append({
                "type": "image_url",
                "image_url": {"url": f"data:{attachment.mime_type};base64,{attachment.data_base64}"},
            })
    return content


def _normalize_codex_code(raw_code: str) -> str | None:
    alnum = "".join(ch for ch in raw_code.upper() if ch.isalnum())
    if len(alnum) != 9:
        return None
    if alnum == "AUTHUSAGE":
        return None
    return f"{alnum[:4]}-{alnum[4:]}"


def _extract_codex_device_code(output: str) -> str | None:
    upper = output.upper()

    # Preferred format from CLI output: 4 chars + separator + 5 chars.
    match = CODEX_DEVICE_CODE_RE.search(upper)
    if match:
        normalized = _normalize_codex_code(f"{match.group(1)}{match.group(2)}")
        if normalized:
            return normalized

    # Fallback for split rendering like one-char-per-line (Y\nI\nR\n7...).
    split_match = CODEX_DEVICE_CODE_SPLIT_RE.search(upper)
    if split_match:
        normalized = _normalize_codex_code(split_match.group(1))
        if normalized:
            return normalized

    return None


def _extract_codex_verification_url(output: str) -> str | None:
    match = CODEX_VERIFICATION_URL_RE.search(output)
    if not match:
        return None
    return match.group(0)


def _codex_is_logged_in() -> bool:
    codex_bin = shutil.which("codex")
    if not codex_bin:
        return False
    try:
        proc = subprocess.run(
            ["codex", "login", "status"],
            capture_output=True,
            text=True,
            timeout=10,
            env={
                **os.environ,
                "PYTHONIOENCODING": "utf-8",
                "PYTHONUTF8": "1",
                "LANG": os.environ.get("LANG", "C.UTF-8"),
                "LC_ALL": os.environ.get("LC_ALL", "C.UTF-8"),
            },
        )
    except Exception:
        return False

    output = f"{proc.stdout}\n{proc.stderr}".strip().lower()
    return proc.returncode == 0 and "logged in" in output


def _run_codex_device_login() -> tuple[str | None, str, str | None, int | None]:
    codex_bin = shutil.which("codex")
    if not codex_bin:
        return None, "Codex CLI is not installed on backend server. Install Codex CLI first.", None, None

    if _codex_is_logged_in():
        CODEX_AUTH_STATE["authenticated"] = True
        CODEX_AUTH_STATE["message"] = "Connected"
        CODEX_AUTH_STATE["code"] = None
        CODEX_AUTH_STATE["code_expires_at"] = 0.0
        CODEX_AUTH_STATE["verification_url"] = CODEX_VERIFICATION_URL
        return None, "Already connected.", CODEX_VERIFICATION_URL, 0

    last_output = ""
    for cmd in CODEX_AUTH_COMMAND_CANDIDATES:
        try:
            proc = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=20,
                env={
                    **os.environ,
                    "PYTHONIOENCODING": "utf-8",
                    "PYTHONUTF8": "1",
                    "LANG": os.environ.get("LANG", "C.UTF-8"),
                    "LC_ALL": os.environ.get("LC_ALL", "C.UTF-8"),
                },
            )
        except FileNotFoundError:
            return None, "Codex CLI binary not found in PATH.", None, None
        except subprocess.TimeoutExpired as exc:
            combined = f"{exc.stdout or ''}\n{exc.stderr or ''}".strip()
            code = _extract_codex_device_code(combined)
            if code:
                verification_url = _extract_codex_verification_url(combined) or CODEX_VERIFICATION_URL
                return code, "Open the verification URL and enter the code.", verification_url, None
            if _codex_is_logged_in():
                CODEX_AUTH_STATE["authenticated"] = True
                CODEX_AUTH_STATE["message"] = "Connected"
                CODEX_AUTH_STATE["code"] = None
                CODEX_AUTH_STATE["code_expires_at"] = 0.0
                return None, "Already connected.", CODEX_VERIFICATION_URL, 0
            return None, "Timed out while starting Codex device auth. Try again.", None, None

        combined_output = f"{proc.stdout}\n{proc.stderr}".strip()
        cleaned_output = ANSI_ORPHAN_RE.sub("", ANSI_ESCAPE_RE.sub("", combined_output)).strip()
        cleaned_output = _ascii_safe(cleaned_output)
        if cleaned_output:
            last_output = cleaned_output

        code = _extract_codex_device_code(cleaned_output)
        if code:
            verification_url = _extract_codex_verification_url(cleaned_output) or CODEX_VERIFICATION_URL
            return code, "Open the verification URL and enter the code.", verification_url, proc.returncode

        if _codex_is_logged_in():
            CODEX_AUTH_STATE["authenticated"] = True
            CODEX_AUTH_STATE["message"] = "Connected"
            CODEX_AUTH_STATE["code"] = None
            CODEX_AUTH_STATE["code_expires_at"] = 0.0
            return None, "Already connected.", CODEX_VERIFICATION_URL, proc.returncode

    if last_output:
        return None, f"Codex CLI did not return a device code. Output: {last_output}", None, None
    return None, "Codex CLI did not return a device code.", None, None


def _codex_refresh_state_if_expired() -> None:
    expires_at = float(CODEX_AUTH_STATE.get("code_expires_at") or 0.0)
    if CODEX_AUTH_STATE.get("code") and expires_at and time.time() >= expires_at:
        CODEX_AUTH_STATE["code"] = None
        CODEX_AUTH_STATE["code_expires_at"] = 0.0
        if not CODEX_AUTH_STATE.get("authenticated"):
            CODEX_AUTH_STATE["message"] = "Not authenticated."


def _codex_retry_after_seconds() -> int:
    now = time.time()
    allowed_at = float(CODEX_AUTH_STATE.get("next_start_allowed_at") or 0.0)
    if allowed_at <= now:
        return 0
    return max(1, int(allowed_at - now))


def _codex_status_payload() -> dict[str, Any]:
    _codex_refresh_state_if_expired()

    # Keep state aligned with CLI session in case login happened in terminal.
    if not CODEX_AUTH_STATE.get("authenticated") and _codex_is_logged_in():
        CODEX_AUTH_STATE["authenticated"] = True
        CODEX_AUTH_STATE["message"] = "Connected"
        CODEX_AUTH_STATE["code"] = None
        CODEX_AUTH_STATE["code_expires_at"] = 0.0
        CODEX_AUTH_STATE["verification_url"] = CODEX_VERIFICATION_URL

    payload: dict[str, Any] = {
        "authenticated": bool(CODEX_AUTH_STATE.get("authenticated")),
        "message": str(CODEX_AUTH_STATE.get("message") or ""),
        "verification_url": str(CODEX_AUTH_STATE.get("verification_url") or CODEX_VERIFICATION_URL),
    }
    code = _normalize_codex_code(str(CODEX_AUTH_STATE.get("code") or ""))
    if code:
        CODEX_AUTH_STATE["code"] = code
        payload["code"] = code
    else:
        CODEX_AUTH_STATE["code"] = None
    return payload


def _codex_start_payload() -> dict[str, Any]:
    _codex_refresh_state_if_expired()
    retry_after = _codex_retry_after_seconds()
    if retry_after > 0:
        return {
            "authenticated": bool(CODEX_AUTH_STATE.get("authenticated")),
            "code": CODEX_AUTH_STATE.get("code"),
            "verification_url": str(CODEX_AUTH_STATE.get("verification_url") or CODEX_VERIFICATION_URL),
            "output": f"Rate limited. Retry in {retry_after}s.",
            "retry_after_seconds": retry_after,
        }

    if CODEX_AUTH_STATE.get("authenticated"):
        return {
            "authenticated": True,
            "code": None,
            "verification_url": str(CODEX_AUTH_STATE.get("verification_url") or CODEX_VERIFICATION_URL),
            "output": "Already connected.",
            "retry_after_seconds": None,
        }

    code, output_message, verification_url, _ = _run_codex_device_login()
    now = time.time()
    CODEX_AUTH_STATE["next_start_allowed_at"] = now + CODEX_MIN_RETRY_SECONDS

    if CODEX_AUTH_STATE.get("authenticated"):
        CODEX_AUTH_STATE["code"] = None
        CODEX_AUTH_STATE["code_expires_at"] = 0.0
        CODEX_AUTH_STATE["message"] = "Connected"
        CODEX_AUTH_STATE["verification_url"] = verification_url or CODEX_VERIFICATION_URL
        return {
            "authenticated": True,
            "code": None,
            "verification_url": CODEX_AUTH_STATE["verification_url"],
            "output": output_message or "Already connected.",
            "retry_after_seconds": None,
        }

    normalized_code = _normalize_codex_code(str(code or ""))
    if not normalized_code:
        CODEX_AUTH_STATE["code"] = None
        CODEX_AUTH_STATE["code_expires_at"] = 0.0
        CODEX_AUTH_STATE["message"] = output_message
        CODEX_AUTH_STATE["verification_url"] = verification_url or CODEX_VERIFICATION_URL
        return {
            "authenticated": False,
            "code": None,
            "verification_url": CODEX_AUTH_STATE["verification_url"],
            "output": output_message,
            "retry_after_seconds": None,
        }

    CODEX_AUTH_STATE["code"] = normalized_code
    CODEX_AUTH_STATE["code_expires_at"] = now + CODEX_CODE_TTL_SECONDS
    CODEX_AUTH_STATE["message"] = "Awaiting device verification."
    CODEX_AUTH_STATE["verification_url"] = verification_url or CODEX_VERIFICATION_URL

    return {
        "authenticated": False,
        "code": normalized_code,
        "verification_url": CODEX_AUTH_STATE["verification_url"],
        "output": "Open the verification URL and enter the code.",
        "retry_after_seconds": None,
    }

async def get_openrouter_models(api_key: str) -> list[dict[str, Any]]:
    now = time.time()
    if MODEL_CACHE["models"] and (now - MODEL_CACHE["fetched_at"]) < MODEL_CACHE_TTL_SECONDS:
        return MODEL_CACHE["models"]
    headers = {"Authorization": f"Bearer {api_key}", "HTTP-Referer": DEFAULT_REFERER, "X-Title": DEFAULT_TITLE}
    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.get(OPENROUTER_MODELS_URL, headers=headers)
        if response.status_code != 200:
            raise RuntimeError(f"OpenRouter models request failed ({response.status_code})")
        models = response.json().get("data", [])
        MODEL_CACHE["fetched_at"] = now
        MODEL_CACHE["models"] = models
        return models


@app.get("/api/health")
async def health_check() -> JSONResponse:
    return JSONResponse(content={"ok": True})


@app.get("/api/codex/status")
async def codex_status() -> JSONResponse:
    return JSONResponse(content=_codex_status_payload())


@app.get("/api/codex/device-auth/start")
@app.post("/api/codex/device-auth/start")
async def codex_device_auth_start() -> JSONResponse:
    payload = _codex_start_payload()
    output = str(payload.get("output") or "")
    if "Rate limited" in output:
        return JSONResponse(status_code=429, content=payload)
    return JSONResponse(content=payload)


@app.post("/api/codex/disconnect")
async def codex_disconnect() -> JSONResponse:
    CODEX_AUTH_STATE["authenticated"] = False
    CODEX_AUTH_STATE["code"] = None
    CODEX_AUTH_STATE["code_expires_at"] = 0.0
    CODEX_AUTH_STATE["next_start_allowed_at"] = 0.0
    CODEX_AUTH_STATE["message"] = "Disconnected"
    CODEX_AUTH_STATE["verification_url"] = CODEX_VERIFICATION_URL
    return JSONResponse(content={"ok": True, "message": "Disconnected"})


@app.post("/api/chat")
async def chat_endpoint(payload: ChatPayload) -> StreamingResponse:
    system_prompt = build_system_prompt(payload.vfs, payload.system_prompt)

    async def openrouter_stream_generator():
        api_key = str(payload.api_key or os.getenv("OPENROUTER_API_KEY") or "").strip()
        if not api_key:
            yield f"data: {json.dumps({'error': 'Missing OpenRouter API key. Add it in Settings or OPENROUTER_API_KEY env.'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        request_data = {
            "model": payload.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": build_user_message(payload)},
            ],
            "stream": True,
        }
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(120.0)) as client:
                async with client.stream("POST", OPENROUTER_URL, headers=headers, json=request_data) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        yield f"data: {json.dumps({'error': body.decode('utf-8', errors='replace')})}\n\n"
                        return
                    async for chunk in response.aiter_lines():
                        if chunk.startswith("data:"):
                            yield f"{chunk}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        yield "data: [DONE]\n\n"

    async def codex_stream_generator():
        codex_bin = shutil.which("codex")
        if not codex_bin:
            yield f"data: {json.dumps({'error': 'Codex CLI is not installed on backend server.'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        if not _codex_is_logged_in():
            yield f"data: {json.dumps({'error': 'ChatGPT Codex is not connected. Open Settings and connect Codex first.'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        codex_model = payload.model.strip() if payload.model.strip() else "gpt-5.2-codex"
        with tempfile.NamedTemporaryFile(prefix="codex-chat-", suffix=".txt", delete=False) as out_file:
            out_path = out_file.name

        user_prompt = payload.message.strip()
        if payload.attachments:
            attachment_names = ", ".join(att.name for att in payload.attachments)
            user_prompt = f"{user_prompt}\n\nAttached files: {attachment_names}"

        composed_prompt = f"System instructions:\n{system_prompt}\n\nUser request:\n{user_prompt}"
        cmd = ["codex", "exec", composed_prompt, "--model", codex_model, "-o", out_path]

        try:
            proc = await asyncio.to_thread(
                subprocess.run,
                cmd,
                capture_output=True,
                text=True,
                timeout=180,
                env={
                    **os.environ,
                    "PYTHONIOENCODING": "utf-8",
                    "PYTHONUTF8": "1",
                    "LANG": os.environ.get("LANG", "C.UTF-8"),
                    "LC_ALL": os.environ.get("LC_ALL", "C.UTF-8"),
                },
            )

            output_text = ""
            try:
                output_text = Path(out_path).read_text(encoding="utf-8").strip()
            except Exception:
                output_text = ""

            if proc.returncode != 0:
                err = (proc.stderr or proc.stdout or "Codex request failed.").strip()
                yield f"data: {json.dumps({'error': _ascii_safe(err)})}\n\n"
                yield "data: [DONE]\n\n"
                return

            if not output_text:
                fallback = (proc.stdout or "").strip()
                if fallback:
                    output_text = fallback

            if not output_text:
                yield f"data: {json.dumps({'error': 'Codex returned an empty response.'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            chunk = {
                "choices": [
                    {"delta": {"content": output_text}}
                ]
            }
            yield f"data: {json.dumps(chunk)}\n\n"
        except subprocess.TimeoutExpired:
            yield f"data: {json.dumps({'error': 'Codex request timed out.'})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            try:
                Path(out_path).unlink(missing_ok=True)
            except Exception:
                pass
            yield "data: [DONE]\n\n"

    model_provider = (payload.model_provider or "openrouter").strip().lower()
    stream_generator = codex_stream_generator if model_provider == "codex" else openrouter_stream_generator
    return StreamingResponse(stream_generator(), media_type="text/event-stream")

@app.get("/api/models/openrouter")
async def openrouter_models(api_key: str) -> JSONResponse:
    try:
        models = await get_openrouter_models(api_key)
        normalized = [{"id": m.get("id"), "name": m.get("name"), "context_length": m.get("context_length")} for m in models]
        return JSONResponse(content={"models": normalized})
    except Exception as exc:
        return JSONResponse(status_code=502, content={"error": str(exc), "models": []})


@app.post("/api/models/recommend")
async def recommend_model(payload: RecommendPayload) -> JSONResponse:
    candidates = [candidate.strip() for candidate in payload.candidates if candidate and candidate.strip()]
    if not candidates:
        return JSONResponse(content={"recommended": None, "reason": "No model candidates provided."})

    message = payload.message.lower()
    ranked = sorted(candidates, key=lambda candidate: len(candidate))

    keyword_priority = [
        ("reason|math|analysis|plan|logic", ["gpt-5.3", "gpt-5"]),
        ("code|debug|typescript|python|api|refactor|bug|error|html|css|js", ["gpt-5.2", "claude", "qwen"]),
        ("image|vision|photo|screenshot", ["gpt-4o", "vision", "gemini"]),
    ]

    for pattern, preferred_tokens in keyword_priority:
        if re.search(pattern, message):
            for token in preferred_tokens:
                for candidate in candidates:
                    if token in candidate.lower():
                        return JSONResponse(content={"recommended": candidate, "reason": f"Matched intent keyword: {token}."})

    preferred = ranked[0]
    return JSONResponse(content={"recommended": preferred, "reason": "Using default heuristic fallback."})


if __name__ == "__main__":
    import uvicorn
    # Final safety: use a logger that won't panic on UTF-8 characters
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")