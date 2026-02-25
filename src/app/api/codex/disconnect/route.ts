import { NextRequest } from "next/server";

const DEFAULT_DEV_BACKEND_URL = "http://127.0.0.1:8001";
const FALLBACK_DEV_BACKEND_URL = "http://127.0.0.1:8000";

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

export async function POST(req: NextRequest) {
  const backendBaseUrls = getBackendBaseUrls();
  if (backendBaseUrls.length === 0) {
    return Response.json(
      {
        ok: false,
        message: "PYTHON_BACKEND_URL is not configured on this deployment.",
      },
      { status: 500 }
    );
  }

  if (isBlockedLocalUrl(backendBaseUrls[0])) {
    return Response.json(
      {
        ok: true,
        message: "Codex backend is disabled in this deployment (localhost backend URL). Nothing to disconnect.",
      },
      { status: 200 }
    );
  }

  const body = await req.text().catch(() => "");
  let lastError: unknown = null;

  for (const baseUrl of backendBaseUrls) {
    const upstreamUrl = `${baseUrl}/api/codex/disconnect`;

    try {
      const res = await fetch(upstreamUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });
      const text = await res.text();

      let data: { ok?: boolean; message?: string };
      try {
        data = JSON.parse(text) as { ok?: boolean; message?: string };
      } catch {
        data = { ok: false, message: `Backend returned non-JSON response from ${upstreamUrl}.` };
      }

      return Response.json(data, { status: res.status });
    } catch (err) {
      lastError = err;
    }
  }

  const attempted = backendBaseUrls.map((url) => `${url}/api/codex/disconnect`).join(", ");
  return Response.json(
    {
      ok: false,
      message: `Cannot reach backend server via ${attempted}. ${String(lastError)}`,
    },
    { status: 502 }
  );
}
