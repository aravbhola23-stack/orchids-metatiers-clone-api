import { NextRequest } from "next/server";

const DEFAULT_DEV_BACKEND_URL = "http://127.0.0.1:8001";
const FALLBACK_DEV_BACKEND_URL = "http://127.0.0.1:8000";
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

function isBlockedLocalUrl(url: string) {
  return process.env.VERCEL === "1" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(url);
}

function getBackendBaseUrls(): string[] {
  const configured = process.env.PYTHON_BACKEND_URL?.trim().replace(/\/+$/, "");
  if (!configured) {
    return [DEFAULT_DEV_BACKEND_URL, FALLBACK_DEV_BACKEND_URL];
  }

  const urls = [configured];
  const isLocal = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(configured);
  if (isLocal && configured !== FALLBACK_DEV_BACKEND_URL) {
    urls.push(FALLBACK_DEV_BACKEND_URL);
  }

  return urls;
}

function isLikelyMaskedKey(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return true;
  if (/^[•*\u2022]+$/.test(trimmed)) return true;
  if (/[^\x20-\x7E]/.test(trimmed)) return true;
  return false;
}

function sseError(status: number, message: string): Response {
  return new Response(`data: ${JSON.stringify({ error: message })}\n\n`, {
    status,
    headers: { "Content-Type": "text/event-stream" },
  });
}

type IncomingAttachment = {
  name?: string;
  mime_type?: string;
  data_base64?: string;
};

type IncomingChatBody = {
  message?: string;
  model?: string;
  model_provider?: string;
  api_key?: string;
  system_prompt?: string;
  attachments?: IncomingAttachment[];
};

function mapModelForOpenRouter(model: string): string {
  const normalized = model.trim().toLowerCase();

  // Codex-style aliases are not valid OpenRouter IDs in this route.
  if (normalized === "codex-gpt-5.3" || normalized === "gpt-5.3" || normalized === "openai/gpt-5.3") {
    return "openai/gpt-5.2-chat";
  }

  if (normalized === "codex-gpt-5.2" || normalized === "gpt-5.2" || normalized === "openai/gpt-5.2") {
    return "openai/gpt-5.2-chat";
  }

  if (/^codex-/i.test(model)) {
    return "openai/gpt-4o-mini";
  }

  return model;
}

async function streamViaOpenRouter(rawBody: string): Promise<Response> {
  let parsed: IncomingChatBody;
  try {
    parsed = JSON.parse(rawBody) as IncomingChatBody;
  } catch {
    return sseError(400, "Invalid JSON body.");
  }

  const fallbackOpenRouterKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  const requestApiKey = typeof parsed.api_key === "string" ? parsed.api_key.trim() : "";
  const apiKey = isLikelyMaskedKey(requestApiKey) ? fallbackOpenRouterKey : requestApiKey;

  if (!apiKey) {
    return sseError(401, "Missing OpenRouter API key. Add it in Settings or OPENROUTER_API_KEY.");
  }

  const userText = typeof parsed.message === "string" ? parsed.message : "";
  const requestedModel = typeof parsed.model === "string" && parsed.model.trim() ? parsed.model.trim() : "openai/gpt-4o-mini";
  const model = mapModelForOpenRouter(requestedModel);

  const userContentParts: Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }> = [
    { type: "text", text: userText || "Hello" },
  ];

  const attachments = Array.isArray(parsed.attachments) ? parsed.attachments : [];
  for (const attachment of attachments) {
    const mimeType = attachment.mime_type?.trim();
    const base64 = attachment.data_base64?.trim();
    if (!mimeType || !base64 || !mimeType.startsWith("image/")) continue;
    userContentParts.push({
      type: "image_url",
      image_url: { url: `data:${mimeType};base64,${base64}` },
    });
  }

  const messages: Array<Record<string, unknown>> = [];
  const systemPrompt = parsed.system_prompt?.trim();
  if (systemPrompt) {
    messages.push({ role: "system", content: systemPrompt });
  }

  messages.push({
    role: "user",
    content: userContentParts.length === 1 ? userContentParts[0].text : userContentParts,
  });

  const upstreamRes = await fetch(OPENROUTER_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages, stream: true }),
  });

  if (!upstreamRes.ok || !upstreamRes.body) {
    const detail = await upstreamRes.text().catch(() => "");
    return sseError(
      upstreamRes.status || 502,
      detail || `OpenRouter request failed with status ${upstreamRes.status}.`
    );
  }

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
}

export async function GET() {
  return Response.json(
    {
      ok: true,
      message: "Use POST /api/chat with JSON body to stream chat responses.",
      deployment_hint:
        "In production, /api/chat uses OpenRouter directly when PYTHON_BACKEND_URL points to localhost.",
    },
    { status: 200 }
  );
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      Allow: "GET,POST,OPTIONS",
    },
  });
}

export async function POST(req: NextRequest) {
  const backendBaseUrls = getBackendBaseUrls();
  const rawBody = await req.text();
  const fallbackOpenRouterKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";

  let forwardedBody = rawBody;
  let requestProvider = "openrouter";
  try {
    const parsed = JSON.parse(rawBody) as {
      api_key?: string | null;
      model?: string | null;
      model_provider?: string | null;
    } & Record<string, unknown>;
    const requestApiKey = typeof parsed.api_key === "string" ? parsed.api_key.trim() : "";
    const requestModel = typeof parsed.model === "string" ? parsed.model : "";
    requestProvider = typeof parsed.model_provider === "string" ? parsed.model_provider.trim().toLowerCase() : "openrouter";
    const normalizedModel = requestProvider === "codex"
      ? requestModel
      : (requestModel ? mapModelForOpenRouter(requestModel) : requestModel);

    forwardedBody = JSON.stringify({
      ...parsed,
      model: normalizedModel,
      api_key: fallbackOpenRouterKey && isLikelyMaskedKey(requestApiKey) ? fallbackOpenRouterKey : requestApiKey,
    });
  } catch {
    forwardedBody = rawBody;
  }

  // On Vercel, localhost backend URLs are unreachable: handle chat directly via OpenRouter.
  if (backendBaseUrls.length === 0 || isBlockedLocalUrl(backendBaseUrls[0])) {
    if (requestProvider === "codex") {
      return sseError(503, "ChatGPT Codex requires the Python backend. Start backend and retry.");
    }
    return streamViaOpenRouter(forwardedBody);
  }

  let lastError: unknown = null;

  for (const baseUrl of backendBaseUrls) {
    const upstreamUrl = `${baseUrl}/api/chat`;

    try {
      const upstreamRes = await fetch(upstreamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: forwardedBody,
        // @ts-expect-error Node fetch supports this but types lag.
        duplex: "half",
      });

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "X-Accel-Buffering": "no",
        },
      });
    } catch (err) {
      lastError = err;
    }
  }

  // If Python backend is down, still allow chat by using direct OpenRouter fallback.
  const openRouterFallback = await streamViaOpenRouter(forwardedBody);
  if (openRouterFallback.status < 500) {
    return openRouterFallback;
  }

  const attempted = backendBaseUrls.map((url) => `${url}/api/chat`).join(", ");
  return new Response(
    `data: ${JSON.stringify({ error: `Cannot reach Python backend via ${attempted}. ${String(lastError)}` })}\n\n`,
    { status: 502, headers: { "Content-Type": "text/event-stream" } }
  );
}
