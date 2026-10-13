import type {
  MessageTemplate,
  StandardMessagingRecipient as MessagingRecipient,
} from "@mms/shared";
import {
  readComposerDraft,
  resolveComposerUserId,
  type MessageComposerDraftV1,
} from "./messageComposerDraft";

export function resolveComposerInitialState(args: {
  channel: "sms" | "whatsapp" | "email";
  recipients: MessagingRecipient[];
  initialMessage?: string;
  initialSubject?: string;
  channelTemplates: MessageTemplate[];
  activeTemplates: MessageTemplate[];
  user?: unknown;
}): {
  draft: MessageComposerDraftV1 | null;
  templateId: string;
  subject: string;
  message: string;
  localRecipients: MessagingRecipient[];
  step: "pick" | "compose";
  userId?: string;
} {
  const userId = resolveComposerUserId(args.user);
  const draft = args.recipients.length === 0 ? readComposerDraft(args.channel, userId) : null;
  const templateId =
    draft?.templateId || args.channelTemplates[0]?.id || args.activeTemplates[0]?.id || "custom";
  const message =
    args.initialMessage ||
    draft?.message ||
    args.channelTemplates[0]?.body ||
    args.activeTemplates[0]?.body ||
    "";
  const subject = args.initialSubject ?? draft?.subject ?? "";
  const localRecipients =
    args.recipients.length > 0
      ? args.recipients
      : ((draft?.recipients ?? []) as MessagingRecipient[]);
  const step: "pick" | "compose" =
    args.recipients.length > 0 || localRecipients.length > 0 ? "compose" : "pick";
  return { draft, templateId, subject, message, localRecipients, step, userId };
}

export function recipientIdsKey(recipients: MessagingRecipient[]): string {
  return recipients
    .map((r) => String(r.id))
    .sort()
    .join(",");
}
