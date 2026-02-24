from __future__ import annotations

import asyncio
import base64
import json
import os
import re
import shlex
import time
import zipfile
from io import BytesIO
from pathlib import Path
import tempfile
from typing import Any

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
CODEX_DEVICE_AUTH_COOLDOWN_SECONDS = int(os.getenv("CODEX_DEVICE_AUTH_COOLDOWN_SECONDS", "60"))
CODEX_DEVICE_AUTH_COOLDOWN_UNTIL = 0.0


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


class CodexCommandResult(BaseModel):
    authenticated: bool
    code: str | None = None
    verification_url: str | None = None
    output: str | None = None
    retry_after_seconds: int | None = None


def build_system_prompt(vfs: dict[str, str], custom_system_prompt: str | None = None) -> str:
    base_prompt = (
        "You are an expert Senior Web Developer. "
        "The user is working in a multi-file web IDE. "
        "Always return complete file replacements in markdown fenced blocks where the fence label is the filename."
    )
    if custom_system_prompt:
        base_prompt = f"{base_prompt}\n\nUser system prompt:\n{custom_system_prompt.strip()}"

    return (
        f"{base_prompt}\n\n"
        "Current project files:\n"
        f"{json.dumps(vfs, indent=2)}"
    )


def build_user_message(payload: ChatPayload) -> str | list[dict[str, Any]]:
    if not payload.attachments:
        return payload.message

    content: list[dict[str, Any]] = [{"type": "text", "text": payload.message}]
    for attachment in payload.attachments:
        if not attachment.mime_type.startswith("image/"):
            continue
        content.append(
            {
                "type": "image_url",
                "image_url": {
                    "url": f"data:{attachment.mime_type};base64,{attachment.data_base64}"
                },
            }
        )
    return content


async def get_openrouter_models(api_key: str) -> list[dict[str, Any]]:
    now = time.time()
    cached_models = MODEL_CACHE.get("models", [])
    fetched_at = float(MODEL_CACHE.get("fetched_at", 0.0))
    if cached_models and (now - fetched_at) < MODEL_CACHE_TTL_SECONDS:
        return cached_models

    headers = {
        "Authorization": f"Bearer {api_key}",
        "HTTP-Referer": DEFAULT_REFERER,
        "X-Title": DEFAULT_TITLE,
    }
    timeout = httpx.Timeout(connect=20.0, read=40.0, write=20.0, pool=20.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.get(OPENROUTER_MODELS_URL, headers=headers)
        if response.status_code != 200:
            raise RuntimeError(f"OpenRouter models request failed ({response.status_code})")
        payload = response.json()
        models = payload.get("data", []) if isinstance(payload, dict) else []
        if not isinstance(models, list):
            models = []
        MODEL_CACHE["fetched_at"] = now
        MODEL_CACHE["models"] = models
        return models


def rank_model_for_prompt(prompt: str, model_id: str) -> int:
    text = prompt.lower()
    model = model_id.lower()
    score = 0
    if any(k in text for k in ["code", "fix", "bug", "typescript", "python", "react", "refactor", "deploy"]):
        if any(k in model for k in ["gpt-5", "gpt-4", "coder", "qwen"]):
            score += 4
    if any(k in text for k in ["reason", "math", "analysis", "plan", "logic"]):
        if any(k in model for k in ["r1", "o1", "o3", "gpt-5", "think", "reason"]):
            score += 4
    if any(k in model for k in ["gpt-5", "gpt-4.1", "gpt-4o"]):
        score += 2
    if any(k in model for k in [":free", "mini", "nano"]):
        score -= 1
    return score


def codex_curated_models() -> list[dict[str, str]]:
    return [
        {"id": "gpt-5.3", "label": "GPT-5.3 Codex"},
        {"id": "gpt-5.2", "label": "GPT-5.2 Codex"},
        {"id": "openai/gpt-5.2-chat", "label": "GPT-5.2"},
        {"id": "deepseek/deepseek-r1", "label": "DeepSeek"},
        {"id": "google/gemini-3-flash", "label": "Gemini 3 Flash"},
        {"id": "meta-llama/llama-4", "label": "Llama 4"},
        {"id": "openai/gpt-4o-mini", "label": "GPT-4o Mini"},
    ]


def codex_model_keywords() -> tuple[str, ...]:
    return (
        "gpt-5.3",
        "gpt-5.2",
        "gpt-4o-mini",
        "deepseek-r1",
        "gemini-3-flash",
        "llama-4",
    )


def codex_label(model_id: str) -> str:
    return model_id.split("/", 1)[-1].replace("-", " ").replace(":", " ").title()


def merge_codex_models(dynamic_models: list[dict[str, Any]] | None = None) -> list[dict[str, str]]:
    merged: dict[str, str] = {m["id"]: m["label"] for m in codex_curated_models()}
    if dynamic_models:
        for model in dynamic_models:
            model_id = model.get("id") if isinstance(model, dict) else None
            if not isinstance(model_id, str) or not model_id:
                continue
            lowered = model_id.lower()
            if not any(keyword in lowered for keyword in codex_model_keywords()):
                continue
            merged.setdefault(model_id, codex_label(model_id))
    return [{"id": model_id, "label": label} for model_id, label in merged.items()]


def is_codex_model(model_id: str) -> bool:
    normalized = model_id.strip().lower()
    if "/" in normalized:
        normalized = normalized.split("/", 1)[1]
    return normalized in {"gpt-5.3", "gpt-5.2"}


def should_use_codex(model_id: str, model_provider: str | None = None) -> bool:
    # Codex model IDs must always route to Codex, even if frontend provider metadata is stale.
    if is_codex_model(model_id):
        return True

    provider = (model_provider or "").strip().lower()
    if provider == "codex":
        return True
    if provider == "openrouter":
        return False
    return False


def codex_cli_model_id(model_id: str) -> str:
    normalized = model_id.strip().lower()
    if "/" in normalized:
        normalized = normalized.split("/", 1)[1]
    return normalized


class RecommendPayload(BaseModel):
    message: str = Field(min_length=1)
    candidates: list[str] = Field(default_factory=list)
    api_key: str | None = None


class DeployPayload(BaseModel):
    vfs: dict[str, str]
    custom_domain: str | None = None


@app.get("/api/health")
async def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/chat")
async def chat_endpoint(payload: ChatPayload) -> StreamingResponse:
    system_prompt = build_system_prompt(payload.vfs, payload.system_prompt)

    async def codex_stream_generator() -> Any:
        prompt_parts = [
            "SYSTEM INSTRUCTIONS:",
            system_prompt,
            "",
            "USER REQUEST:",
            payload.message,
        ]
        if payload.attachments:
            prompt_parts.extend(["", "Attached image names:"])
            prompt_parts.extend([f"- {attachment.name}" for attachment in payload.attachments])

        final_prompt = "\n".join(prompt_parts)
        model_name = codex_cli_model_id(payload.model)
        with tempfile.NamedTemporaryFile(mode="w", encoding="utf-8", delete=False) as prompt_file:
            prompt_file.write(final_prompt)
            prompt_path = prompt_file.name

        cmd = ["codex", "exec", "-m", model_name, "--skip-git-repo-check", "--output-last-message", "-", "-"]
        auth_error_detected = False

        process = None
        try:
            process = await asyncio.create_subprocess_exec(
                *cmd,
                stdin=asyncio.subprocess.PIPE,
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.STDOUT,
            )
            if process.stdin is not None:
                with open(prompt_path, "rb") as prompt_reader:
                    process.stdin.write(prompt_reader.read())
                await process.stdin.drain()
                process.stdin.close()

            if process.stdout is None:
                yield f"data: {json.dumps({'error': 'Codex output stream unavailable'})}\n\n"
                yield "data: [DONE]\n\n"
                return

            while True:
                chunk = await process.stdout.read(1024)
                if not chunk:
                    break
                text = chunk.decode("utf-8", errors="ignore")
                if not text:
                    continue

                clean_text = ANSI_ESCAPE_RE.sub("", text)
                clean_text = ANSI_ORPHAN_RE.sub("", clean_text)
                lowered = clean_text.lower()
                if "401 unauthorized" in lowered or "missing bearer" in lowered:
                    auth_error_detected = True

                payload_chunk = {"choices": [{"delta": {"content": clean_text}}]}
                yield f"data: {json.dumps(payload_chunk)}\n\n"

            return_code = await process.wait()
            if return_code != 0:
                detail = "Codex execution failed. Reconnect Codex and retry."
                if auth_error_detected:
                    detail = "Codex is not authenticated. Open Settings and reconnect ChatGPT Codex."
                error_payload = {
                    "error": f"Codex request failed with status {return_code}",
                    "detail": detail,
                }
                yield f"data: {json.dumps(error_payload)}\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
        finally:
            try:
                os.remove(prompt_path)
            except OSError:
                pass
            if process is not None and process.returncode is None:
                process.kill()
            yield "data: [DONE]\n\n"

    async def openrouter_stream_generator() -> Any:
        request_data: dict[str, Any] = {
            "model": payload.model,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": build_user_message(payload)},
            ],
            "stream": True,
        }

        if not payload.api_key:
            yield f"data: {json.dumps({'error': 'OpenRouter API key is required for this model.'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        headers = {
            "Authorization": f"Bearer {payload.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": DEFAULT_REFERER,
            "X-Title": DEFAULT_TITLE,
        }

        timeout = httpx.Timeout(connect=30.0, read=120.0, write=30.0, pool=30.0)

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                async with client.stream("POST", OPENROUTER_URL, headers=headers, json=request_data) as response:
                    if response.status_code != 200:
                        body = await response.aread()
                        details = body.decode("utf-8", errors="ignore")[:600]
                        error_payload = {
                            "error": f"OpenRouter request failed with status {response.status_code}",
                            "detail": details,
                        }
                        yield f"data: {json.dumps(error_payload)}\n\n"
                        yield "data: [DONE]\n\n"
                        return

                    async for chunk in response.aiter_lines():
                        if not chunk:
                            continue
                        if chunk.startswith("data:"):
                            yield f"{chunk}\n\n"
        except Exception as exc:  # noqa: BLE001
            yield f"data: {json.dumps({'error': str(exc)})}\n\n"
            yield "data: [DONE]\n\n"

    use_codex = should_use_codex(payload.model, payload.model_provider)
    generator = codex_stream_generator() if use_codex else openrouter_stream_generator()
    return StreamingResponse(generator, media_type="text/event-stream")


@app.get("/api/models/openrouter")
async def openrouter_models(api_key: str) -> JSONResponse:
    try:
        models = await get_openrouter_models(api_key)
    except Exception as exc:  # noqa: BLE001
        return JSONResponse(status_code=502, content={"error": str(exc), "models": []})

    normalized = [
        {
            "id": m.get("id", ""),
            "name": m.get("name") or m.get("id", ""),
            "context_length": m.get("context_length", 0),
        }
        for m in models
        if isinstance(m, dict) and isinstance(m.get("id"), str)
    ]
    return JSONResponse(content={"models": normalized})


@app.get("/api/models/codex")
async def codex_models(api_key: str | None = None) -> JSONResponse:
    dynamic_models: list[dict[str, Any]] = []
    if api_key:
        try:
            dynamic_models = await get_openrouter_models(api_key)
        except Exception:
            dynamic_models = []
    return JSONResponse(content={"models": merge_codex_models(dynamic_models)})


@app.post("/api/models/recommend")
async def recommend_model(payload: RecommendPayload) -> JSONResponse:
    dynamic_models: list[dict[str, Any]] = []
    if payload.api_key:
        try:
            dynamic_models = await get_openrouter_models(payload.api_key)
        except Exception:
            dynamic_models = []

    codex_model_ids = [m["id"] for m in merge_codex_models(dynamic_models)]
    candidates = payload.candidates or codex_model_ids
    if not candidates:
        return JSONResponse(status_code=400, content={"error": "No candidates provided"})

    scored = [(model_id, rank_model_for_prompt(payload.message, model_id)) for model_id in candidates]
    scored.sort(key=lambda item: item[1], reverse=True)
    best, best_score = scored[0]

    prompt_lower = payload.message.lower()
    reason = "Best overall Codex model for this prompt."
    if any(k in prompt_lower for k in ["code", "fix", "bug", "typescript", "python", "react", "refactor", "deploy"]):
        reason = "Your prompt is code-heavy, so this coding-capable model is prioritized."
    elif any(k in prompt_lower for k in ["reason", "math", "analysis", "plan", "logic"]):
        reason = "Your prompt needs deeper reasoning, so the highest reasoning-scored model is selected."
    elif best_score <= 0:
        reason = "No strong keyword match found; using the best available default Codex model."

    return JSONResponse(content={"recommended": best, "ranked": [model_id for model_id, _ in scored[:8]], "reason": reason})


async def run_tty_command(command: str, timeout_seconds: int = 20) -> tuple[int, str]:
    wrapped = f"script -q /dev/null -c {shlex.quote(command)}"
    process = await asyncio.create_subprocess_shell(
        wrapped,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.STDOUT,
    )

    try:
        stdout, _ = await asyncio.wait_for(process.communicate(), timeout=timeout_seconds)
    except TimeoutError:
        process.kill()
        return 124, "Codex login is taking too long. Try again, then run 'codex login --device-auth' manually in the backend terminal if it still times out."

    output = stdout.decode("utf-8", errors="ignore")
    ansi_escape = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
    return process.returncode or 0, ansi_escape.sub("", output).strip()


async def run_codex_command(timeout_seconds: int = 90) -> CodexCommandResult:
    code, output = await run_tty_command("codex login --device-auth", timeout_seconds=timeout_seconds)

    if code == 127 or "not found" in output.lower():
        return CodexCommandResult(
            authenticated=False,
            output="Codex CLI is not installed on this server. Install it first.",
        )

    code_pattern = re.compile(r"\b[A-Z0-9]{4}-[A-Z0-9]{5}\b")
    url_pattern = re.compile(r"https?://[^\s\x1b]+")

    match_code = code_pattern.search(output)
    match_url = url_pattern.search(output)

    return CodexCommandResult(
        authenticated=False,
        code=match_code.group(0) if match_code else None,
        verification_url=match_url.group(0) if match_url else "https://auth.openai.com/codex/device",
        output="\n".join(output.splitlines()[-30:]) if output else None,
    )


@app.get("/api/codex/device-auth/start")
async def codex_device_auth_start() -> JSONResponse:
    global CODEX_DEVICE_AUTH_COOLDOWN_UNTIL

    now = time.time()
    if now < CODEX_DEVICE_AUTH_COOLDOWN_UNTIL:
        retry_after_seconds = max(1, int(CODEX_DEVICE_AUTH_COOLDOWN_UNTIL - now))
        return JSONResponse(
            status_code=429,
            content=CodexCommandResult(
                authenticated=False,
                output=f"Device auth is temporarily rate-limited. Try again in {retry_after_seconds}s.",
                retry_after_seconds=retry_after_seconds,
            ).model_dump(),
        )

    result = await run_codex_command(timeout_seconds=90)
    if not result.code:
        lowered = (result.output or "").lower()
        if "429" in lowered or "too many" in lowered or "rate limit" in lowered:
            CODEX_DEVICE_AUTH_COOLDOWN_UNTIL = time.time() + CODEX_DEVICE_AUTH_COOLDOWN_SECONDS
            result.retry_after_seconds = CODEX_DEVICE_AUTH_COOLDOWN_SECONDS
            return JSONResponse(status_code=429, content=result.model_dump())
        return JSONResponse(status_code=500, content=result.model_dump())

    CODEX_DEVICE_AUTH_COOLDOWN_UNTIL = 0.0
    result.retry_after_seconds = None
    return JSONResponse(content=result.model_dump())


@app.get("/api/codex/status")
async def codex_status() -> JSONResponse:
    code, output = await run_tty_command("codex login status", timeout_seconds=12)
    lowered = output.lower()

    if code == 127 or "not found" in lowered:
        return JSONResponse(content={"authenticated": False, "message": "Codex CLI is not installed."})

    if "logged in" in lowered and "not logged" not in lowered:
        return JSONResponse(content={"authenticated": True, "message": "Connected"})

    unauth_signals = ("not logged", "not authenticated", "login", "unauthorized", "stdout is not a terminal", "stdin is not a terminal")
    if any(signal in lowered for signal in unauth_signals):
        return JSONResponse(content={"authenticated": False, "message": "Not authenticated."})

    return JSONResponse(content={"authenticated": False, "message": output or "Not authenticated."})


@app.post("/api/codex/disconnect")
async def codex_disconnect() -> JSONResponse:
    code, output = await run_tty_command("codex logout", timeout_seconds=20)
    lowered = output.lower()
    if code == 127 or "not found" in lowered:
        return JSONResponse(content={"ok": False, "message": "Codex CLI is not installed."}, status_code=404)
    if code != 0 and "not logged" not in lowered:
        return JSONResponse(content={"ok": False, "message": output or "Failed to disconnect Codex."}, status_code=500)
    return JSONResponse(content={"ok": True, "message": "Codex disconnected."})


@app.post("/api/publish/vercel")
async def publish_vercel(payload: DeployPayload) -> JSONResponse:
    DEPLOYMENTS_DIR.mkdir(parents=True, exist_ok=True)
    workspace = DEPLOYMENTS_DIR / f"deploy-{int(time.time() * 1000)}"
    workspace.mkdir(parents=True, exist_ok=True)

    try:
        for file_name, content in payload.vfs.items():
            if not file_name or ".." in file_name or file_name.startswith("/"):
                return JSONResponse(status_code=400, content={"error": f"Invalid file path: {file_name}"})
            target = workspace / file_name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_text(content, encoding="utf-8")

        token = os.getenv("VERCEL_TOKEN", "")
        if not token:
            return JSONResponse(
                status_code=400,
                content={
                    "ok": False,
                    "error": "VERCEL_TOKEN is missing on backend. Add a valid Vercel token to enable one-click deploy.",
                },
            )

        cmd = ["npx", "vercel", "--prod", "--yes", "--token", token]
        process = await asyncio.create_subprocess_exec(
            *cmd,
            cwd=str(workspace),
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.STDOUT,
        )

        try:
            stdout, _ = await asyncio.wait_for(process.communicate(), timeout=300)
        except TimeoutError:
            process.kill()
            return JSONResponse(status_code=504, content={"error": "Vercel deploy timed out"})

        output = stdout.decode("utf-8", errors="ignore")
        ansi_escape = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")
        clean_output = ansi_escape.sub("", output)
        lowered = clean_output.lower()

        if "token is not valid" in lowered or "invalid token" in lowered:
            return JSONResponse(
                status_code=401,
                content={"ok": False, "error": "VERCEL_TOKEN is invalid. Generate a new token and update backend environment.", "output": clean_output[-4000:]},
            )

        url_match = re.search(r"https://[^\s]+\.vercel\.app", clean_output)
        if process.returncode == 0:
            deployed_url = url_match.group(0) if url_match else ""
            domain_message = ""
            custom_domain = (payload.custom_domain or "").strip()
            if custom_domain:
                domain_cmd = ["npx", "vercel", "domains", "add", custom_domain, "--token", token]
                domain_process = await asyncio.create_subprocess_exec(
                    *domain_cmd,
                    cwd=str(workspace),
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.STDOUT,
                )
                try:
                    domain_stdout, _ = await asyncio.wait_for(domain_process.communicate(), timeout=120)
                    domain_output = ansi_escape.sub("", domain_stdout.decode("utf-8", errors="ignore"))
                    if domain_process.returncode == 0:
                        domain_message = f"Custom domain '{custom_domain}' added. Configure DNS in Vercel dashboard."
                    else:
                        domain_message = (
                            f"Deploy succeeded but custom domain add failed for '{custom_domain}'. "
                            f"Details: {domain_output[-400:]}"
                        )
                except TimeoutError:
                    domain_process.kill()
                    domain_message = f"Deploy succeeded but custom domain add timed out for '{custom_domain}'."
            return JSONResponse(content={
                "ok": True,
                "url": deployed_url,
                "output": clean_output[-4000:],
                "domain_message": domain_message,
            })
        return JSONResponse(status_code=500, content={"ok": False, "output": clean_output[-4000:]})

    finally:
        for f in workspace.rglob("*"):
            if f.is_file():
                f.unlink(missing_ok=True)
        for d in sorted([d for d in workspace.rglob("*") if d.is_dir()], reverse=True):
            d.rmdir()
        workspace.rmdir()


@app.post("/api/code/download")
async def download_code(payload: DeployPayload):
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, "w", compression=zipfile.ZIP_DEFLATED) as zf:
        for file_name, content in payload.vfs.items():
            if not file_name or ".." in file_name or file_name.startswith("/"):
                return JSONResponse(status_code=400, content={"error": f"Invalid file path: {file_name}"})
            zf.writestr(file_name, content)
    zip_bytes = buffer.getvalue()
    headers = {"Content-Disposition": "attachment; filename=project-files.zip"}
    return StreamingResponse(iter([zip_bytes]), media_type="application/zip", headers=headers)

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
