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

export async function GET() {
  const backendBaseUrls = getBackendBaseUrls();
  if (backendBaseUrls.length === 0) {
    return Response.json(
      {
        authenticated: false,
        message: "PYTHON_BACKEND_URL is not configured on this deployment.",
      },
      { status: 500 }
    );
  }

  if (isBlockedLocalUrl(backendBaseUrls[0])) {
      return Response.json(
        {
          authenticated: false,
          message:
            "Codex Connect is unavailable in deployment because PYTHON_BACKEND_URL is localhost. Set PYTHON_BACKEND_URL to your public backend URL (example: https://api.yourdomain.com).",
          verification_url: "https://auth.openai.com/codex/device",
        },
        { status: 200 }
      );
  }

  let lastError: unknown = null;

  for (const baseUrl of backendBaseUrls) {
    const upstreamUrl = `${baseUrl}/api/codex/status`;

    try {
      const res = await fetch(upstreamUrl, { cache: "no-store" });
      const text = await res.text();

      let data: { authenticated?: boolean; message?: string };
      try {
        data = JSON.parse(text) as { authenticated?: boolean; message?: string };
      } catch {
        data = {
          authenticated: false,
          message: `Backend returned non-JSON response from ${upstreamUrl}.`,
        };
      }

      return Response.json(data, { status: res.status });
    } catch (err) {
      lastError = err;
    }
  }

  const attempted = backendBaseUrls.map((url) => `${url}/api/codex/status`).join(", ");
  return Response.json(
    {
      authenticated: false,
      message: `Cannot reach backend server via ${attempted}. ${String(lastError)}`,
    },
    { status: 502 }
  );
}
