import { z } from "zod";
import { messageChannelSchema } from "./messagingCategorySchemas.js";

export const messagingSmsDispatchModeSchema = z.enum(["gateway", "device"]);
export type MessagingSmsDispatchMode = z.infer<typeof messagingSmsDispatchModeSchema>;

export const messagingDispatchSpeedSchema = z.enum(["safe", "normal", "express"]);
export type MessagingDispatchSpeed = z.infer<typeof messagingDispatchSpeedSchema>;

export const messagingPreferencesSchema = z.object({
  defaultChannel: messageChannelSchema.default("sms"),
  defaultSmsMode: messagingSmsDispatchModeSchema.default("gateway"),
  defaultDispatchSpeed: messagingDispatchSpeedSchema.default("normal"),
  defaultCountryCode: z.string().max(10).optional().default(""),
});

export type MessagingPreferences = z.infer<typeof messagingPreferencesSchema>;

export const DEFAULT_MESSAGING_PREFERENCES: MessagingPreferences = {
  defaultChannel: "sms",
  defaultSmsMode: "gateway",
  defaultDispatchSpeed: "normal",
  defaultCountryCode: "",
};

export function normalizeMessagingPreferences(raw: unknown): MessagingPreferences {
  if (!raw || typeof raw !== "object") {
    return { ...DEFAULT_MESSAGING_PREFERENCES };
  }
  const parsed = messagingPreferencesSchema.safeParse(raw);
  if (parsed.success) {
    return parsed.data;
  }
  return { ...DEFAULT_MESSAGING_PREFERENCES };
}
