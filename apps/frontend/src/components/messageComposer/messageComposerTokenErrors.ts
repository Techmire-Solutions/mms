import { findUnknownPersonalizationTokens } from "@mms/shared";
import { findUnknownTokens } from "./messageComposerDispatchService";

export function formatUnknownTokensLabel(tokens: string[]): string {
  return tokens.map((token) => `{${token}}`).join(", ");
}

export function unknownTokenFieldErrors(args: {
  channel: "sms" | "whatsapp" | "email";
  subject: string;
  message: string;
  errorMsg: string;
}): { bodyError?: string; subjectError?: string } {
  const unknown = findUnknownTokens(args.channel, args.subject, args.message);
  if (unknown.length === 0) return {};
  const bodyUnknown = findUnknownPersonalizationTokens(args.message);
  const subjectUnknown =
    args.channel === "email" ? findUnknownPersonalizationTokens(args.subject) : [];
  return {
    bodyError: bodyUnknown.length > 0 ? args.errorMsg : undefined,
    subjectError: subjectUnknown.length > 0 ? args.errorMsg : undefined,
  };
}

export function hasUnknownComposeTokens(
  channel: "sms" | "whatsapp" | "email",
  subject: string,
  message: string,
): boolean {
  return findUnknownTokens(channel, subject, message).length > 0;
}

export function liveUnknownTokenLabels(value: string): string | undefined {
  const unknown = findUnknownPersonalizationTokens(value);
  return unknown.length > 0 ? formatUnknownTokensLabel(unknown) : undefined;
}
