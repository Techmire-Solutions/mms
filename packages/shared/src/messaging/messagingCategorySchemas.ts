import { z } from "zod";

export const MESSAGE_CATEGORIES = [
  "general",
  "academic",
  "financial",
  "attendance",
  "emergency",
] as const;

export const MESSAGE_CHANNELS = ["all", "sms", "whatsapp", "email"] as const;

export const MESSAGE_CATEGORY_OPTIONS = MESSAGE_CATEGORIES.map((cat) => ({
  value: cat,
  labelKey: `messaging.category.${cat}` as const,
}));

export const MESSAGE_CHANNEL_OPTIONS = MESSAGE_CHANNELS.map((ch) => ({
  value: ch,
  labelKey: `messaging.channel.${ch}` as const,
}));

export const messageCategorySchema = z.enum(MESSAGE_CATEGORIES);

export const messageChannelSchema = z.enum(MESSAGE_CHANNELS);

/** Message category union derived from MESSAGE_CATEGORIES. */
export type MessageCategory = (typeof MESSAGE_CATEGORIES)[number];

export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];
