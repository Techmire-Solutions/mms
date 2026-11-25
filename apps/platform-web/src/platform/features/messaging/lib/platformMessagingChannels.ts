import type { AppTranslationKey } from "@mms/contracts";

export const PLATFORM_MESSAGING_CHANNELS = ["sms", "whatsapp", "email"] as const;
export type PlatformMessagingChannel = (typeof PLATFORM_MESSAGING_CHANNELS)[number];

export const PLATFORM_MESSAGING_CHANNEL_LABEL_KEYS: Record<
  PlatformMessagingChannel,
  AppTranslationKey
> = {
  sms: "platform.messaging.channel.sms",
  whatsapp: "platform.messaging.channel.whatsapp",
  email: "platform.messaging.channel.email",
};
