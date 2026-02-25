import { NextRequest } from "next/server";

const DEFAULT_DEV_BACKEND_URL = "http://127.0.0.1:8001";
const FALLBACK_DEV_BACKEND_URL = "http://127.0.0.1:8000";

function isBlockedLocalUrl(url: string): boolean {
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

function builtInModels() {
  return [
    { id: "meta-llama/llama-3.2-3b-instruct:free", name: "Llama 3.2 3B Instruct (Free)" },
    { id: "openai/gpt-4o-mini", name: "GPT-4o Mini" },
    { id: "openai/gpt-5.2-chat", name: "GPT-5.2" },
  ];
}

export async function GET(req: NextRequest) {
  const apiKey = req.nextUrl.searchParams.get("api_key") ?? "";
  const backendBaseUrls = getBackendBaseUrls();

  if (backendBaseUrls.length === 0 || isBlockedLocalUrl(backendBaseUrls[0])) {
    return Response.json({ models: builtInModels(), source: "builtin" }, { status: 200 });
  }

  for (const baseUrl of backendBaseUrls) {
    const upstreamUrl = `${baseUrl}/api/models/openrouter?api_key=${encodeURIComponent(apiKey)}`;
    try {
      const res = await fetch(upstreamUrl, { method: "GET", headers: { "Content-Type": "application/json" }, next: { revalidate: 0 } });
      if (!res.ok) continue;
      const data = await res.json();
      return Response.json(data, { status: 200 });
    } catch {
      // try next backend url
    }
  }

  return Response.json({ models: builtInModels(), source: "builtin", error: "Using built-in models because backend is unreachable." }, { status: 200 });
}
