import { env } from "cloudflare:workers";

// Sites injects a stable user ID per Site, so an ID observed in another Site
// cannot be used here. The verified owner email is the cross-Site account key.
export const OWNER_EMAIL = "santinoorona@gmail.com";

export function requireOwner(request: Request) {
  const userId = request.headers.get("oai-authenticated-user-id");
  const email = request.headers.get("oai-authenticated-user-email")?.trim().toLowerCase();
  if (!userId || email !== OWNER_EMAIL) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!env.DB) return Response.json({ error: "Lead storage is not configured." }, { status: 503 });
  return null;
}

export function parseFiles(value: string) {
  try {
    const files = JSON.parse(value) as unknown;
    return Array.isArray(files) ? files.filter((file): file is { field: string; key: string; size: number; contentType: string } => Boolean(file && typeof file === "object" && typeof (file as { key?: unknown }).key === "string")) : [];
  } catch {
    return [];
  }
}
