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
