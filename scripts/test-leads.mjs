import assert from "node:assert/strict";
import test from "node:test";
import { register } from "node:module";
import { isValidImage, isValidVideo } from "../app/api/leads/validation.ts";

const rows = [];
const fakeDb = {
  prepare(sql) {
    return {
      bind(...args) {
        return {
          async run() {
            if (sql.includes("INSERT INTO leads")) rows.push({ id: args[0], kind: args[1], language: args[2], payload: args[3], files: args[4], status: args[5], created_at: args[6] });
            return { success: true };
          },
          async first() { return { count: 1 }; },
          async all() { return { results: rows }; },
        };
      },
    };
  },
};
const fakeBucket = { async put() {}, async delete() {}, async get() { return null; } };
globalThis.__testEnv = { DB: fakeDb, BUCKET: fakeBucket };
register(`data:text/javascript,${encodeURIComponent("export async function resolve(specifier, context, nextResolve) { if (specifier === 'cloudflare:workers') return { url: 'data:text/javascript,export const env = globalThis.__testEnv;', shortCircuit: true }; if (specifier.startsWith('.') && !specifier.endsWith('.ts')) return nextResolve(specifier + '.ts', context); return nextResolve(specifier, context); }")}`, import.meta.url);
const { POST } = await import("../app/api/leads/route.ts");
const { GET: getAdminLeads } = await import("../app/api/admin/leads/route.ts");
const { requireOwner } = await import("../app/api/admin/_auth.ts");

test("accepts matching image signatures and rejects spoofed MIME", () => {
  assert.equal(isValidImage(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), "image/jpeg"), true);
  assert.equal(isValidImage(Uint8Array.from([0xff, 0xd8, 0xff, 0x00]), "image/png"), false);
  assert.equal(isValidImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), "image/png"), true);
});

test("accepts supported video containers only", () => {
  assert.equal(isValidVideo(Uint8Array.from([0x1a, 0x45, 0xdf, 0xa3]), "video/webm"), true);
  assert.equal(isValidVideo(Uint8Array.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70, 0, 0, 0, 0]), "video/mp4"), true);
  assert.equal(isValidVideo(Uint8Array.from([0, 0, 0, 0, 0x66, 0x74, 0x79, 0x70]), "video/mp4"), false);
});

test("handler persists a valid brand lead and rejects incomplete input", async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ language: "es", kind: "brand", name: "Ana", company: "Casino", role: "Marketing", website: "https://example.test", targetMarkets: "ES", proposal: "Campaña", formats: "Video", timing: "Junio", budget: "1000", currency: "EUR", contactMethod: "telegram", contact: "@ana", prepaidAccepted: "true", consent: "true" })) form.set(key, value);
  const response = await POST(new Request("https://example.test/api/leads", { method: "POST", body: form, headers: { "content-length": "1000" } }));
  assert.equal(response.status, 201);
  assert.equal(rows.length, 1);
  const incomplete = new FormData();
  incomplete.set("language", "es");
  incomplete.set("kind", "brand");
  const invalid = await POST(new Request("https://example.test/api/leads", { method: "POST", body: incomplete }));
  assert.equal(invalid.status, 400);
});

test("admin route rejects requests without owner identity", async () => {
  const response = await getAdminLeads(new Request("https://example.test/api/admin/leads"));
  assert.equal(response.status, 403);
});

test("admin auth requires the platform identity and verified owner email", async () => {
  const wrongEmail = requireOwner(new Request("https://example.test", { headers: { "oai-authenticated-user-id": "runtime-site-id", "oai-authenticated-user-email": "other@example.test" } }));
  assert.equal(wrongEmail?.status, 403);
  const missingId = requireOwner(new Request("https://example.test", { headers: { "oai-authenticated-user-email": "santinoorona@gmail.com" } }));
  assert.equal(missingId?.status, 403);
  const owner = requireOwner(new Request("https://example.test", { headers: { "oai-authenticated-user-id": "runtime-site-id", "oai-authenticated-user-email": "santinoorona@gmail.com" } }));
  assert.equal(owner, null);
});

function creatorForm(followers = "10000") {
  const form = new FormData();
  for (const [key, value] of Object.entries({ language: "es", kind: "creator", name: "Test", country: "AR", platform: "instagram", profileUrl: "https://example.test/profile", followers, audienceCountry: "AR", relationship: "both", contactMethod: "email", contact: "test@example.test", adult: "true", casinoAccepted: "true", consent: "true" })) form.set(key, value);
  return form;
}

test("rejects creator below minimum audience and missing required files", async () => {
  const tooSmall = await POST(new Request("https://example.test/api/leads", { method: "POST", body: creatorForm("9999") }));
  assert.equal(tooSmall.status, 400);
  const missingFiles = await POST(new Request("https://example.test/api/leads", { method: "POST", body: creatorForm() }));
  assert.equal(missingFiles.status, 400);
});

test("rejects brand without prepaid acceptance", async () => {
  const form = new FormData();
  for (const [key, value] of Object.entries({ language: "es", kind: "brand", name: "Test", company: "Test", role: "Marketing", website: "https://example.test", targetMarkets: "AR", proposal: "Test", formats: "Video", timing: "Ahora", budget: "100", currency: "USD", contactMethod: "email", contact: "test@example.test", prepaidAccepted: "false", consent: "true" })) form.set(key, value);
  const response = await POST(new Request("https://example.test/api/leads", { method: "POST", body: form }));
  assert.equal(response.status, 400);
});
