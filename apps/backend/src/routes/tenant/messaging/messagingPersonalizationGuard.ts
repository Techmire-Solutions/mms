import { findUnknownPersonalizationTokens } from "@mms/shared";

/** Formats unknown `{token}` keys for API validation_error messages. */
export function formatUnknownTokensMessage(tokens: string[]): string {
  return `Unknown personalization tokens: ${tokens.map((token) => `{${token}}`).join(", ")}`;
}

/** Collects unknown personalization tokens from body and optional subject. */
export function collectUnknownPersonalizationTokens(body: string, subject?: string): string[] {
  const unknown = new Set(findUnknownPersonalizationTokens(body));
  if (subject) {
    for (const token of findUnknownPersonalizationTokens(subject)) {
      unknown.add(token);
    }
  }
  return [...unknown];
}

/**
 * Executable markup a messaging payload must never carry (`mms-messaging` §3:
 * messages are plain text; executable HTML/script is banned). Applied to the
 * email `html` sink, which is forwarded to the SMTP gateway verbatim.
 */
const EXECUTABLE_HTML_PATTERNS: readonly RegExp[] = [
  /<\s*script/i,
  /<\s*iframe/i,
  /<\s*object/i,
  /<\s*embed/i,
  /javascript\s*:/i,
  /\son[a-z]+\s*=/i,
];

export function containsExecutableHtml(value: string): boolean {
  return EXECUTABLE_HTML_PATTERNS.some((pattern) => pattern.test(value));
}
