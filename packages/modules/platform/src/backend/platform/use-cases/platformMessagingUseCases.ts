import { HttpDomainError } from "@mms/be-core/http/errors";
import { platformMessagingRepository } from "../repository/platformMessagingAdapter.js";
import type { PlatformMessageRecipient } from "@mms/contracts";

export interface PlatformMessagingUseCases {
  listMessages(input: {
    channel?: string;
    status?: string;
    limit: number;
    offset: number;
    includeDeleted?: boolean;
  }): ReturnType<typeof platformMessagingRepository.listMessages>;
  send(
    actor: { id: string; email: string },
    input: {
      channel: "sms" | "whatsapp" | "email";
      subject?: string | null;
      body: string;
      contactIds: string[];
      scheduledAt?: string | null;
    },
  ): ReturnType<typeof platformMessagingRepository.send>;
  listTemplates(): ReturnType<typeof platformMessagingRepository.listTemplates>;
  saveTemplate(
    actor: { id: string; email: string },
    id: string,
    input: Parameters<typeof platformMessagingRepository.saveTemplate>[1],
  ): ReturnType<typeof platformMessagingRepository.saveTemplate>;
  deleteTemplate(actor: { id: string; email: string }, id: string): Promise<void>;
  deleteMessage(actor: { id: string; email: string }, id: string): Promise<void>;
  restoreMessage(actor: { id: string; email: string }, id: string): Promise<void>;
  metrics(): ReturnType<typeof platformMessagingRepository.metrics>;
}

async function sendMessage(
  actor: { id: string; email: string },
  input: {
    channel: "sms" | "whatsapp" | "email";
    subject?: string | null;
    body: string;
    contactIds: string[];
    scheduledAt?: string | null;
  },
) {
  const contacts = await platformMessagingRepository.listContacts({
    limit: 500,
    offset: 0,
  });
  const byId = new Map(contacts.map((contact: any) => [(contact as any).id, contact]));
  const recipients: PlatformMessageRecipient[] = input.contactIds.flatMap((id: any) => {
    const contact = byId.get(id);
    if (!contact) return [];
    const address = input.channel === "email" ? (contact as any).email : (contact as any).phone;
    if (!address) return [];
    return [
      {
        contactId: (contact as any).id,
        name: (contact as any).name,
        channel: input.channel,
        address,
      },
    ];
  });
  if (recipients.length === 0) {
    throw new HttpDomainError(422, "validation_error", "No reachable recipients for the channel");
  }

  const message = await platformMessagingRepository.send({
    channel: input.channel,
    subject: input.subject ?? null,
    body: input.body,
    recipientSnapshot: recipients,
    scheduledAt: input.scheduledAt ?? null,
  });
  await platformMessagingRepository.insertActivityLog({
    userId: actor.id,
    userEmail: actor.email,
    action: "platform_message.send",
    targetResource: "platform_messages",
    targetId: message.id,
    metadataMessage: `${recipients.length} recipient(s) via ${input.channel}`,
  });
  return message;
}

async function deleteMessage(actor: { id: string; email: string }, id: string): Promise<void> {
  if (!(await platformMessagingRepository.deleteMessage(id))) {
    throw new HttpDomainError(404, "not_found", "Platform message not found");
  }
  await platformMessagingRepository.insertActivityLog({
    userId: actor.id,
    userEmail: actor.email,
    action: "platform_message.delete",
    targetResource: "platform_messages",
    targetId: id,
  });
}

async function restoreMessage(actor: { id: string; email: string }, id: string): Promise<void> {
  if (!(await platformMessagingRepository.restoreMessage(id))) {
    throw new HttpDomainError(404, "not_found", "Platform message not found");
  }
  await platformMessagingRepository.insertActivityLog({
    userId: actor.id,
    userEmail: actor.email,
    action: "platform_message.restore",
    targetResource: "platform_messages",
    targetId: id,
  });
}

async function deleteTemplate(actor: { id: string; email: string }, id: string): Promise<void> {
  if (!(await platformMessagingRepository.deleteTemplate(id))) {
    throw new HttpDomainError(404, "not_found", "Message template not found");
  }
  await platformMessagingRepository.insertActivityLog({
    userId: actor.id,
    userEmail: actor.email,
    action: "platform_message_template.delete",
    targetResource: "platform_message_templates",
    targetId: id,
  });
}

export const platformMessagingUseCases: PlatformMessagingUseCases = {
  listMessages: (input) => platformMessagingRepository.listMessages(input),
  send: sendMessage,
  listTemplates: () => platformMessagingRepository.listTemplates(),
  saveTemplate: (actor, id, input) => {
    void platformMessagingRepository.insertActivityLog({
      userId: actor.id,
      userEmail: actor.email,
      action: "platform_message_template.save",
      targetResource: "platform_message_templates",
      targetId: id,
    });
    return platformMessagingRepository.saveTemplate(id, input);
  },
  deleteTemplate,
  deleteMessage,
  restoreMessage,
  metrics: () => platformMessagingRepository.metrics(),
};
