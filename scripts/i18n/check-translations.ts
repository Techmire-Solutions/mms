import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const sharedSrc = path.resolve(__dirname, "../../packages/shared/src");

function extractTranslations(filePath: string): Record<string, string> {
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return {};
  }
  const content = fs.readFileSync(filePath, "utf-8");
  const result: Record<string, string> = {};
  const lines = content.split("\n");

  for (const line of lines) {
    const match = line.match(/^\s*"([^"]+)":\s*"(.*)",?$/);
    if (match) {
      result[match[1]] = match[2];
    }
  }
  return result;
}

const en = extractTranslations(path.join(sharedSrc, "appTranslationsEn.ts"));
const ar = extractTranslations(path.join(sharedSrc, "appTranslationsAr.ts"));
const ur = extractTranslations(path.join(sharedSrc, "appTranslationsUr.ts"));
const fa = extractTranslations(path.join(sharedSrc, "appTranslationsFa.ts"));

function isInvariantValue(key: string, value: string): boolean {
  if (value === "—" || value === "%") return true;
  if (value.endsWith(".csv") || value.endsWith(".vcf")) return true;
  if (/^https?:\/\//.test(value)) return true;
  if (/^[\d\s+\-•#]+$/.test(value)) return true;
  if (value.includes("@") && !value.includes(" ")) return true;
  // Template with only placeholders / punctuation left after substituting them
  // (e.g. "{title} {ref}", "{prefix}…") carries no translatable words.
  if (/\{[a-zA-Z]+\}/.test(value) && !/[a-zA-Z]/.test(value.replace(/\{[a-zA-Z]+\}/g, ""))) {
    return true;
  }
  if (/^[a-zA-Z0-9_-]+\.[a-zA-Z0-9_.-]+$/.test(value)) return true;
  if (
    [
      "WhatsApp",
      "SMS",
      "IP",
      "2FA",
      "GR",
      "ISBN",
      "URL",
      "MCQ",
      "PDF",
      "ISO 8601",
      "GSM 7-bit",
      "Arial",
      "Georgia",
      "Monospace",
      "Serif",
      "AsyncLocalStorage",
      "Fastify WebSocket",
      "PostgreSQL 16 (RLS)",
      "Node.js RSS",
      "RLS 100%",
      "Madrasa MS",
      "Apple Contacts",
      "Google Contacts",
      "Gmail / Google Workspace",
      "iCloud Mail",
      "Microsoft 365",
      "Outlook.com / Hotmail",
      "Yahoo Mail",
      "Zoho Mail",
      "Client ID",
      "Client Secret",
      "Top P",
      "Facebook",
      "KB",
      "syed, syeda",
      "(vCard / .vcf)",
      "al-noor",
      "09:00 - 11:00",
      "PK36MEZN00012345678901",
      "MEZNPKKA",
      "Infobip",
      "MSG91",
      "Telesign",
      "Twilio",
      "Vonage (Nexmo)",
      "Logiqueues",
    ].includes(value)
  ) {
    return true;
  }
  if (
    value.startsWith("SMS (") ||
    value.startsWith("WhatsApp (") ||
    value.startsWith("ISBN {") ||
    value.startsWith("¶ {") ||
    value.startsWith("{prefix}-") ||
    value.startsWith(" · ") ||
    value.includes("{quote}") ||
    value.includes("{className}") ||
    value.includes("{stage}")
  ) {
    return true;
  }
  return false;
}

const locales = ["ar", "ur", "fa"] as const;
const missing: Record<(typeof locales)[number], string[]> = { ar: [], ur: [], fa: [] };

for (const [key, enValue] of Object.entries(en)) {
  const invariant = isInvariantValue(key, enValue);
  if (!ar[key] || (!invariant && ar[key] === enValue)) missing.ar.push(key);
  if (!ur[key] || (!invariant && ur[key] === enValue)) missing.ur.push(key);
  if (!fa[key] || (!invariant && fa[key] === enValue)) missing.fa.push(key);
}

console.log("=== MMS Translation Completeness Report ===");
console.log(`Total Keys: ${Object.keys(en).length}`);
console.log(`Arabic (ar) fallback to EN / missing: ${missing.ar.length}`);
console.log(`Urdu (ur) fallback to EN / missing: ${missing.ur.length}`);
console.log(`Farsi (fa) fallback to EN / missing: ${missing.fa.length}`);

const failedLocales = locales.filter((locale) => missing[locale].length > 0);
if (failedLocales.length > 0) {
  for (const locale of failedLocales) {
    console.error(
      `\n✗ ${locale}: ${missing[locale].length} key(s) missing or falling back to English:`,
    );
    for (const key of missing[locale]) console.error(`    ${key}`);
  }
  console.error(
    "\n💥 Translation completeness failed. Add the missing keys to appTranslations{Ar,Ur,Fa}.ts, " +
      "or extend isInvariantValue() if the value is intentionally language-invariant.",
  );
  process.exit(1);
}

console.log("\n✨ All locales complete (no missing or EN-fallback keys).");
