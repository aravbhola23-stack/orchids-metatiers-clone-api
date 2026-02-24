import { NextRequest } from "next/server";

const PYTHON_BACKEND = process.env.PYTHON_BACKEND_URL ?? "http://127.0.0.1:8001";

export async function GET(_req: NextRequest) {
  try {
    const res = await fetch(`${PYTHON_BACKEND}/api/claude/install`);
    const data = await res.json();
    return Response.json(data, { status: res.status });
  } catch {
    return Response.json({ command: "irm https://claude.ai/install.ps1 | iex" }, { status: 200 });
  }
}
