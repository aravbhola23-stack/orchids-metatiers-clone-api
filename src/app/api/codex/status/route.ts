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

export async function GET() {
  const backendBaseUrl = getBackendBaseUrl();
  if (!backendBaseUrl) {
    return Response.json(
      {
        authenticated: false,
        message: "PYTHON_BACKEND_URL is not configured on this deployment.",
      },
      { status: 500 }
    );
  }

  if (process.env.NODE_ENV === "production" && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(backendBaseUrl)) {
    return Response.json(
      {
        authenticated: false,
        message: `PYTHON_BACKEND_URL (${backendBaseUrl}) is local-only and cannot be used in deployment. Set it to a public backend URL.`,
      },
      { status: 500 }
    );
  }

  const upstreamUrl = `${backendBaseUrl}/api/codex/status`;

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
    return Response.json(
      {
        authenticated: false,
        message: `Cannot reach backend server via ${upstreamUrl}. ${String(err)}`,
      },
      { status: 502 }
    );
  }
}
