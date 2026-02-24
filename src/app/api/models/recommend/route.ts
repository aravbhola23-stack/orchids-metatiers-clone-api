import { NextRequest } from "next/server";

const PYTHON_BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://127.0.0.1:8001";

export async function POST(req: NextRequest) {
  const body = await req.text();
  try {
    const res = await fetch(`${PYTHON_BACKEND}/api/models/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ error: "Cannot reach backend server." }, { status: 502 });
  }
}
