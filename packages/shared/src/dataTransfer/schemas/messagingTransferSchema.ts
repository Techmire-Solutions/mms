/**
 * @file messagingTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Messaging.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface MessagingTransferEntity {
  title: string;
  channel: string;
  recipient?: string;
  message: string;
  status?: string;
  sentAt?: string;
  notes?: string;
}

export const messagingTransferSchema: ModuleTransferSchema<MessagingTransferEntity> =
  createModuleTransferSchema<MessagingTransferEntity>({
    moduleId: "messaging",
    entityNounPlural: "templates",
    defaultFilename: "messaging-templates.csv",
    fields: [
      {
        key: "title",
        label: "Template / Campaign Title",
        aliases: ["template", "Campaign", "Title"],
        required: true,
        sample: "Fee Reminder Notice",
        extract: (m) => m.title || "",
      },
      {
        key: "channel",
        label: "Channel",
        aliases: ["type", "Medium", "Platform"],
        required: true,
        sample: "whatsapp",
        extract: (m) => m.channel || "sms",
      },
      {
        key: "recipient",
        label: "Recipient Phone / Email",
        aliases: ["phone", "mobile", "Recipient"],
        sample: "+923001234567",
        extract: (m) => m.recipient || "",
        parse: (raw) => raw.trim().replace(/^'+/, ""),
      },
      {
        key: "message",
        label: "Message Content",
        aliases: ["content", "Body", "Text"],
        required: true,
        sample: "Dear Guardian, fee for Term 1 is due next week. Thank you.",
        extract: (m) => m.message || "",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["Delivery Status"],
        sample: "active",
        extract: (m) => m.status || "draft",
      },
      {
        key: "sentAt",
        label: "Sent Timestamp",
        aliases: ["sent_at", "Date Sent"],
        sample: "2024-09-01 10:00:00",
        extract: (m) => m.sentAt || "",
      },
      {
        key: "notes",
        label: "Notes",
        aliases: ["remarks"],
        sample: "Automated notification template",
        extract: (m) => m.notes || "",
      },
    ],
  });

registerModuleTransferSchema(messagingTransferSchema);
