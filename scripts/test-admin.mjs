import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../app/admin/page.tsx", import.meta.url), "utf8");
function extract(start, end) {
  const match = source.match(new RegExp(`${start}([\\s\\S]*?)${end}`));
  assert.ok(match, `could not extract ${start}`);
  return `${start}${match[1]}`.replace("export function", "function").replaceAll(": unknown", "");
}
const text = vm.runInNewContext(`(${extract("function text", "\\n\\nfunction date")})`, { Intl, Number });
const contactUrl = vm.runInNewContext(`(${extract("function contactUrl", "\\n\\nexport default")})`, {});

test("admin formats numbers and booleans for the panel", () => {
  assert.equal(text(10000), "10.000");
  assert.equal(text(false), "No");
  assert.equal(text(true), "Sí");
  assert.equal(text(Number.NaN), "—");
});

test("admin contact links preserve full URLs and normalize shorthand", () => {
  assert.equal(contactUrl("telegram", "https://t.me/primate"), "https://t.me/primate");
  assert.equal(contactUrl("whatsapp", "https://wa.me/5491122334455"), "https://wa.me/5491122334455");
  assert.equal(contactUrl("telegram", "@primate"), "https://t.me/primate");
  assert.equal(contactUrl("whatsapp", "+54 9 11 2233-4455"), "https://wa.me/5491122334455");
  assert.equal(contactUrl("email", "prueba@example.com"), "mailto:prueba@example.com");
});

