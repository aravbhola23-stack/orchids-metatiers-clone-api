import { NextRequest } from "next/server";

const PYTHON_BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://127.0.0.1:8001";

export async function POST(req: NextRequest) {
  const body = await req.text();
  try {
    const res = await fetch(`${PYTHON_BACKEND}/api/code/download`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({ error: "Failed to build zip archive." }));
      return Response.json(data, { status: res.status });
    }

    const arrayBuffer = await res.arrayBuffer();
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": "attachment; filename=project-files.zip",
      },
    });
  } catch {
    return Response.json({ error: "Cannot reach backend server." }, { status: 502 });
  }
}
