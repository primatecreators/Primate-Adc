import { env } from "cloudflare:workers";
import { parseFiles, requireOwner } from "../_auth";

export async function GET(request: Request) {
  const denied = requireOwner(request);
  if (denied) return denied;
  const key = new URL(request.url).searchParams.get("key") ?? "";
  if (!key.startsWith("leads/") || key.includes("..") || key.includes("\\")) return Response.json({ error: "Invalid file key." }, { status: 400 });
  try {
    const result = await env.DB!.prepare("SELECT files FROM leads WHERE instr(files, ?) > 0 LIMIT 20").bind(key).all<{ files: string }>();
    const linked = result.results.some((row) => parseFiles(row.files).some((file) => file.key === key));
    if (!linked) return Response.json({ error: "File not found." }, { status: 404 });
    if (!env.BUCKET) return Response.json({ error: "Lead storage is not configured." }, { status: 503 });
    const object = await env.BUCKET.get(key);
    if (!object) return Response.json({ error: "File not found." }, { status: 404 });
    return new Response(object.body, { headers: { "Content-Type": object.httpMetadata?.contentType ?? "application/octet-stream", "Content-Length": String(object.size), "Cache-Control": "private, no-store" } });
  } catch {
    return Response.json({ error: "Unable to read file." }, { status: 500 });
  }
}
