import { NextRequest } from "next/server";

const PYTHON_BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://127.0.0.1:8001";

export async function GET(req: NextRequest) {
  const apiKey = req.nextUrl.searchParams.get("api_key") ?? "";
  const suffix = apiKey ? `?api_key=${encodeURIComponent(apiKey)}` : "";
  try {
    const res = await fetch(`${PYTHON_BACKEND}/api/models/codex${suffix}`);
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ models: [], error: "Cannot reach backend server." }, { status: 502 });
  }
}
