import type { StandardMessagingRecipient as MessagingRecipient } from "@mms/shared";

/** Lean recipient snapshot for session drafts (no extra contact fields). */
export type ComposerDraftRecipient = Pick<MessagingRecipient, "id" | "name" | "phone" | "email">;

export interface MessageComposerDraftV1 {
  v: 1;
  channel: "sms" | "whatsapp" | "email";
  userId?: string;
  message: string;
  subject: string;
  templateId: string;
  recipients: ComposerDraftRecipient[];
}

function draftKey(channel: string, userId?: string): string {
  const scope = userId?.trim() ? userId.trim() : "anon";
  return `mms:messaging-compose-draft:v1:${scope}:${channel}`;
}

export function readComposerDraft(
  channel: "sms" | "whatsapp" | "email",
  userId?: string,
): MessageComposerDraftV1 | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(draftKey(channel, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MessageComposerDraftV1;
    if (parsed?.v !== 1 || parsed.channel !== channel) return null;
    if (userId && parsed.userId && parsed.userId !== userId) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeComposerDraft(draft: MessageComposerDraftV1): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.setItem(draftKey(draft.channel, draft.userId), JSON.stringify(draft));
  } catch {
    // Quota / private mode — ignore.
  }
}

export function clearComposerDraft(channel: "sms" | "whatsapp" | "email", userId?: string): void {
  if (typeof sessionStorage === "undefined") return;
  try {
    sessionStorage.removeItem(draftKey(channel, userId));
  } catch {
    // ignore
  }
}

export function resolveComposerUserId(user: unknown): string | undefined {
  if (!user || typeof user !== "object" || !("id" in user)) return undefined;
  const id = (user as { id: unknown }).id;
  return id == null ? undefined : String(id);
}
