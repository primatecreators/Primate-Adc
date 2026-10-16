import { env } from "cloudflare:workers";
import { isValidImage, isValidVideo } from "./validation";
import { BRAND_FIELDS, CREATOR_FIELDS } from "./fields";

type Kind = "creator" | "brand";
type Language = "es" | "en";
type StoredFile = { field: string; key: string; size: number; contentType: string };
class LeadValidationError extends Error {}
const CONTACT_METHODS = ["whatsapp", "telegram", "email", "other"];
const RELATIONSHIPS = ["representation", "campaign", "both"];
const PLATFORMS = ["instagram", "tiktok", "youtube", "twitch", "x", "other"];

const MAX_TOTAL = 65 * 1024 * 1024;
const MAX_IMAGE = 10 * 1024 * 1024;
const MAX_VIDEO = 20 * 1024 * 1024;
const MAX_REQUEST = 70 * 1024 * 1024;

function text(form: FormData, field: string) {
  const value = form.get(field);
  return typeof value === "string" ? value.trim() : "";
}

function localized(language: Language, es: string, en: string) {
  return language === "en" ? en : es;
}

function parseBool(form: FormData, field: string) {
  return ["true", "1", "on", "yes"].includes(text(form, field).toLowerCase());
}

function isFile(value: FormDataEntryValue | null): value is File {
  return typeof File !== "undefined" && value instanceof File && value.size > 0;
}

async function hash(value: string) {
  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function enforceRateLimit(request: Request) {
  if (!env.DB) throw new Error("DB_MISSING");
  const ip = request.headers.get("CF-Connecting-IP") ?? "";
  const fingerprint = `${ip}|${request.headers.get("User-Agent") ?? ""}|${request.headers.get("Accept-Language") ?? ""}`;
  const key = await hash(fingerprint || "anonymous");
  const bucket = `${key}:${Math.floor(Date.now() / 3_600_000)}`;
  const now = Date.now();
  await env.DB.prepare("DELETE FROM lead_rate_limits WHERE updated_at < ?").bind(now - 86_400_000).run();
  await env.DB.prepare(
    "INSERT INTO lead_rate_limits (bucket, count, updated_at) VALUES (?, 1, ?) ON CONFLICT(bucket) DO UPDATE SET count = count + 1, updated_at = excluded.updated_at",
  ).bind(bucket, now).run();
  const row = await env.DB.prepare("SELECT count FROM lead_rate_limits WHERE bucket = ?").bind(bucket).first<{ count: number }>();
  if ((row?.count ?? 0) > 20) throw new Error("RATE_LIMIT");
}

async function collectFile(form: FormData, field: string, kind: "image" | "video", max: number, language: Language) {
  const value = form.get(field);
  if (!isFile(value)) throw new LeadValidationError(localized(language, `Falta el archivo ${field}.`, `The ${field} file is required.`));
  if (value.size > max) throw new LeadValidationError(localized(language, `El archivo ${field} supera el tamaño permitido.`, `The ${field} file is too large.`));
  const bytes = new Uint8Array(await value.slice(0, 32).arrayBuffer());
  const valid = kind === "image" ? isValidImage(bytes, value.type) : isValidVideo(bytes, value.type);
  if (!valid) throw new LeadValidationError(localized(language, `El archivo ${field} no tiene un formato válido.`, `The ${field} file format is invalid.`));
  return { file: value, size: value.size, contentType: value.type };
}

export async function POST(request: Request) {
  let uploaded: string[] = [];
  let responseLanguage: Language = request.headers.get("accept-language")?.toLowerCase().startsWith("en") ? "en" : "es";
  try {
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    if (contentLength > MAX_REQUEST) return Response.json({ error: localized(responseLanguage, "La solicitud es demasiado grande.", "The request is too large.") }, { status: 413 });
    if (!env.DB || !env.BUCKET) return Response.json({ error: localized(responseLanguage, "El almacenamiento de registros no está configurado.", "Lead storage is not configured.") }, { status: 503 });
    await enforceRateLimit(request);
    const form = await request.formData();
    const language = text(form, "language") as Language;
    responseLanguage = language === "en" ? "en" : "es";
    const kind = text(form, "kind") as Kind;
    if (!(language === "es" || language === "en")) return Response.json({ error: "Language is required." }, { status: 400 });
    if (!(kind === "creator" || kind === "brand")) return Response.json({ error: localized(language, "El tipo de registro no es válido.", "The registration type is invalid.") }, { status: 400 });
    if (text(form, "websiteConfirm")) return Response.json({ error: localized(language, "No se pudo procesar el formulario.", "The form could not be processed.") }, { status: 400 });
    const required = kind === "creator" ? CREATOR_FIELDS : BRAND_FIELDS;
    const missing = required.find((field) => !text(form, field));
    if (missing) return Response.json({ error: localized(language, `Falta completar: ${missing}.`, `Please complete: ${missing}.`) }, { status: 400 });
    const maxLengths: Record<string, number> = { proposal: 5000, profileUrl: 2000, website: 2000, name: 500, country: 500, platform: 500, audienceCountry: 500, relationship: 500, contactMethod: 500, contact: 500, company: 500, role: 500, targetMarkets: 500, formats: 500, timing: 500, budget: 500, currency: 500 };
    const tooLong = required.find((field) => text(form, field).length > (maxLengths[field] ?? 500));
    if (tooLong) return Response.json({ error: localized(language, `El campo ${tooLong} es demasiado largo.`, `The ${tooLong} field is too long.`) }, { status: 400 });
    const profileUrl = text(form, "profileUrl");
    const website = text(form, "website");
    if ((profileUrl && !/^https?:\/\//i.test(profileUrl)) || (website && !/^https?:\/\//i.test(website))) return Response.json({ error: localized(language, "Las URLs deben comenzar con http:// o https://.", "URLs must start with http:// or https://.") }, { status: 400 });
    if (!CONTACT_METHODS.includes(text(form, "contactMethod").toLowerCase())) return Response.json({ error: localized(language, "El medio de contacto no es válido.", "The contact method is invalid.") }, { status: 400 });
    if (kind === "creator") {
      if (!PLATFORMS.includes(text(form, "platform").toLowerCase())) return Response.json({ error: localized(language, "La plataforma no es válida.", "The platform is invalid.") }, { status: 400 });
      if (!RELATIONSHIPS.includes(text(form, "relationship").toLowerCase())) return Response.json({ error: localized(language, "El tipo de relación no es válido.", "The relationship type is invalid.") }, { status: 400 });
      const followers = Number(text(form, "followers"));
      if (!Number.isInteger(followers) || followers < 10_000) return Response.json({ error: localized(language, "Se requiere un mínimo de 10.000 seguidores.", "At least 10,000 followers are required.") }, { status: 400 });
      if (!parseBool(form, "adult") || !parseBool(form, "casinoAccepted")) return Response.json({ error: localized(language, "Debés confirmar mayoría de edad y disponibilidad para campañas de casino.", "You must confirm adult age and casino campaign availability.") }, { status: 400 });
    } else if (!parseBool(form, "prepaidAccepted")) {
      return Response.json({ error: localized(language, "Solo aceptamos campañas con importe fijo y pago previo.", "We only accept fixed-fee campaigns with prepayment.") }, { status: 400 });
    }
    if (!parseBool(form, "consent")) return Response.json({ error: localized(language, "Debés aceptar el uso de estos datos para revisar y responder tu propuesta.", "You must consent to review and respond to your proposal.") }, { status: 400 });

    const files: Array<{ field: string; file: File; size: number; contentType: string }> = [];
    if (kind === "creator") {
      for (const [field, type, max] of [["reach7", "image", MAX_IMAGE], ["demographics", "image", MAX_IMAGE], ["stories7", "video", MAX_VIDEO], ["stories30", "video", MAX_VIDEO]] as const) {
        files.push({ field, ...(await collectFile(form, field, type, max, language)) });
      }
      if (files.reduce((sum, file) => sum + file.size, 0) > MAX_TOTAL) return Response.json({ error: localized(language, "El total de archivos supera el límite permitido.", "The total file size exceeds the limit.") }, { status: 413 });
    }
    const id = crypto.randomUUID();
    const stored: StoredFile[] = [];
    for (const item of files) {
      const key = `leads/${id}/${crypto.randomUUID()}`;
      await env.BUCKET.put(key, item.file.stream(), { httpMetadata: { contentType: item.contentType } });
      uploaded.push(key);
      stored.push({ field: item.field, key, size: item.size, contentType: item.contentType });
    }
    const payload: Record<string, string | number | boolean> = {};
    for (const field of required) payload[field] = field === "followers" ? Number(text(form, field)) : ["adult", "casinoAccepted", "prepaidAccepted", "consent"].includes(field) ? parseBool(form, field) : text(form, field);
    await env.DB.prepare("INSERT INTO leads (id, kind, language, payload, files, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(id, kind, language, JSON.stringify(payload), JSON.stringify(stored), "pending", Date.now()).run();
    return Response.json({ ok: true, id }, { status: 201 });
  } catch (error) {
    if (uploaded.length && env.BUCKET) await Promise.allSettled(uploaded.map((key) => env.BUCKET!.delete(key)));
    if (error instanceof Error && error.message === "RATE_LIMIT") return Response.json({ error: localized(responseLanguage, "Demasiadas solicitudes. Intentá nuevamente más tarde.", "Too many requests. Please try again later.") }, { status: 429 });
    if (error instanceof Error && error.message === "DB_MISSING") return Response.json({ error: localized(responseLanguage, "El almacenamiento de registros no está configurado.", "Lead storage is not configured.") }, { status: 503 });
    if (error instanceof LeadValidationError) return Response.json({ error: error.message }, { status: 400 });
    console.error("Lead submission failed", error instanceof Error ? error.name : "unknown");
    return Response.json({ error: localized(responseLanguage, "No se pudo procesar el formulario.", "Unable to process the form.") }, { status: 500 });
  }
}
