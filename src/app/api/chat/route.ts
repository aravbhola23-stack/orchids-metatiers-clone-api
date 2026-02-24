import { NextRequest } from "next/server";

const DEFAULT_DEV_BACKEND_URL = "http://127.0.0.1:8001";

function getBackendBaseUrl() {
  const configured = process.env.PYTHON_BACKEND_URL?.trim();
  if (configured) {
    return configured.replace(/\/+$/, "");
  }

  if (process.env.NODE_ENV !== "production") {
    return DEFAULT_DEV_BACKEND_URL;
  }

  return null;
}

export async function POST(req: NextRequest) {
  const backendBaseUrl = getBackendBaseUrl();
  if (!backendBaseUrl) {
    return new Response(
      `data: ${JSON.stringify({ error: "PYTHON_BACKEND_URL is not configured on this deployment." })}\n\n`,
      { status: 500, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  if (process.env.NODE_ENV === "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(backendBaseUrl)) {
    return new Response(
      `data: ${JSON.stringify({ error: `PYTHON_BACKEND_URL (${backendBaseUrl}) is local-only and cannot be used in deployment. Set it to a public backend URL.` })}\n\n`,
      { status: 500, headers: { "Content-Type": "text/event-stream" } }
    );
  }

  const body = await req.text();
  const upstreamUrl = `${backendBaseUrl}/api/chat`;

  try {
    const upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
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
    return new Response(
      `data: ${JSON.stringify({ error: `Cannot reach Python backend via ${upstreamUrl}. ${String(err)}` })}\n\n`,
      { status: 502, headers: { "Content-Type": "text/event-stream" } }
    );
  }
}
