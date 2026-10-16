import { env } from "cloudflare:workers";
import { requireOwner } from "../_auth";

export async function GET(request: Request) {
  const denied = requireOwner(request);
  if (denied) return denied;
  try {
    const url = new URL(request.url);
    const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 25) || 25, 1), 100);
    const offset = Math.max(Number(url.searchParams.get("offset") ?? 0) || 0, 0);
    const result = await env.DB!.prepare("SELECT id, kind, language, payload, files, status, created_at FROM leads ORDER BY created_at DESC LIMIT ? OFFSET ?").bind(limit, offset).all();
    const leads = result.results.map((row) => ({
      ...row,
      payload: typeof row.payload === "string" ? JSON.parse(row.payload) : row.payload,
      files: typeof row.files === "string" ? JSON.parse(row.files) : row.files,
    }));
    return Response.json({ leads, limit, offset });
  } catch {
    return Response.json({ error: "Unable to read leads." }, { status: 500 });
  }
}
