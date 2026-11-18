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
  message: string;
  category?: string;
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
        key: "message",
        label: "Message Content",
        aliases: ["content", "Body", "Text"],
        required: true,
        sample: "Dear Guardian, fee for Term 1 is due next week. Thank you.",
        extract: (m) => m.message || "",
      },
      {
        key: "category",
        label: "Category",
        aliases: ["category", "Category", "Category Type"],
        sample: "general",
        extract: (m) => m.category || "general",
      },
    ],
  });

registerModuleTransferSchema(messagingTransferSchema);
