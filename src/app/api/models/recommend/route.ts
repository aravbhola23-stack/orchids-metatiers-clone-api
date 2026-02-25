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

type RecommendBody = {
  message?: string;
  candidates?: string[];
};

function heuristicPick(message: string, candidates: string[]): { recommended: string; reason: string } {
  const n = message.toLowerCase();
  const preferred =
    /reason|math|analysis|think|plan|logic/.test(n)
      ? ["gpt-5.3", "gpt-5.2", "openai/gpt-4o-mini"]
      : /code|debug|typescript|python|api|refactor|bug|error|html|css|js/.test(n)
        ? ["gpt-5.2", "openai/gpt-4o-mini", "gpt-5.3"]
        : /image|vision|photo|screenshot/.test(n)
          ? ["openai/gpt-4o-mini", "gpt-5.2", "gpt-5.3"]
          : ["gpt-5.2", "openai/gpt-4o-mini", "gpt-5.3"];

  for (const id of preferred) {
    const match = candidates.find((candidate) => candidate === id);
    if (match) {
      return { recommended: match, reason: `Matched intent keyword: ${match}.` };
    }
  }

  return {
    recommended: candidates[0] ?? "openai/gpt-4o-mini",
    reason: "Using first available model candidate.",
  };
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const backendBaseUrls = getBackendBaseUrls();

  let parsed: RecommendBody = {};
  try {
    parsed = JSON.parse(body) as RecommendBody;
  } catch {
    parsed = {};
  }

  const message = typeof parsed.message === "string" ? parsed.message : "";
  const candidates = Array.isArray(parsed.candidates) ? parsed.candidates.filter((c): c is string => typeof c === "string" && c.trim().length > 0) : [];

  if (backendBaseUrls.length === 0 || isBlockedLocalUrl(backendBaseUrls[0])) {
    return Response.json(heuristicPick(message, candidates), { status: 200 });
  }

  let lastError: unknown = null;
  for (const baseUrl of backendBaseUrls) {
    const upstreamUrl = `${baseUrl}/api/models/recommend`;
    try {
      const res = await fetch(upstreamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const data = await res.json();
      return Response.json(data, { status: res.status });
    } catch (err) {
      lastError = err;
    }
  }

  return Response.json(heuristicPick(message, candidates), {
    status: 200,
    headers: { "X-Recommendation-Fallback": "heuristic" },
  });
}
