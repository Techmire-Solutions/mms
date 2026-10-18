import { z } from "zod";
import type { Permission } from "../auth/permissions.js";
import type { PersonalizeRecipient } from "../core/utils.js";
import type { AppTranslationKey } from "../i18n/appTranslations.js";
import {
  MESSAGE_CATEGORIES,
  MESSAGE_CHANNELS,
  MESSAGE_CATEGORY_OPTIONS,
  MESSAGE_CHANNEL_OPTIONS,
} from "./messagingSchemas.js";

export const MESSAGING_ROLE_FILTERS = ["all", "students", "faculty", "staff", "contacts"] as const;
export const MESSAGING_GENDER_FILTERS = ["all", "male", "female", "unspecified"] as const;
export const MESSAGING_STATUS_FILTERS = ["all", "sent", "delivered", "failed", "skipped"] as const;

export type MessagingRoleFilter = (typeof MESSAGING_ROLE_FILTERS)[number];
export type MessagingGenderFilter = (typeof MESSAGING_GENDER_FILTERS)[number];
export type MessagingStatusFilter = (typeof MESSAGING_STATUS_FILTERS)[number];

export const MESSAGING_ROLE_OPTIONS = MESSAGING_ROLE_FILTERS.map((role) => ({
  value: role,
  labelKey: `messaging.role.${role}` as const,
}));

export const MESSAGING_GENDER_OPTIONS = MESSAGING_GENDER_FILTERS.map((gender) => ({
  value: gender,
  labelKey: `messaging.gender.${gender}` as const,
}));

export const MESSAGING_STATUS_OPTIONS = MESSAGING_STATUS_FILTERS.map((status) => ({
  value: status,
  labelKey: `messaging.status.${status}` as const,
}));

/** Messaging module manifest — aligns with universal module architecture. */
export const MESSAGING_MODULE_MANIFEST = {
  moduleId: "messaging",
  entityType: "Message",
  collectionKey: "messages",
  restBasePath: "/api/messaging",
  tiers: ["work", "reports", "setup"] as const,
  setupSubTabs: ["templates"] as const,
  softDelete: {
    workExcludesDeleted: true,
    reportsIncludeDeleted: false,
    exportsIncludeDeleted: false,
    captureDeletionReason: false,
    retentionDays: 365,
  },
  recipientsColumnPreferencesObjectKey: "messaging_recipients_user_column_preferences",
  historyColumnPreferencesObjectKey: "messaging_history_user_column_preferences",
  templatesColumnPreferencesObjectKey: "messaging_templates_user_column_preferences",
  permissions: {
    read: "messaging.read",
    write: "messaging.write",
    clearLogs: "messaging.clearLogs",
    setupView: "configuration.view",
    setupWrite: "messaging.write",
    reports: "messaging.read",
  } satisfies Record<string, Permission>,
  /** Admin clear soft-archives active logs (typed `deleted_at`); not a Contacts-style trash browser. */
  logRetention: "soft-archive-clear" as const,
  categories: MESSAGE_CATEGORIES,
  channels: MESSAGE_CHANNELS,
  categoryOptions: MESSAGE_CATEGORY_OPTIONS,
  channelOptions: MESSAGE_CHANNEL_OPTIONS,
  roleOptions: MESSAGING_ROLE_OPTIONS,
  genderOptions: MESSAGING_GENDER_OPTIONS,
  statusOptions: MESSAGING_STATUS_OPTIONS,
} as const;

export type MessagingModuleTier = (typeof MESSAGING_MODULE_MANIFEST.tiers)[number];

/**
 * Resolves the visual badge styling for message channels.
 */
export function getChannelBadgeStyle(channel: "sms" | "whatsapp" | "email" | string): string {
  if (channel === "email") {
    return "bg-warning/10 text-warning border border-warning/20";
  }
  if (channel === "sms") {
    return "bg-info/10 text-info border border-info/20";
  }
  return "bg-success/10 text-success border border-success/20";
}

/**
 * Helper to get the i18n label key for a message channel.
 */
export function getChannelLabelKey(channel: string): AppTranslationKey {
  return `messaging.channel.${channel}` as AppTranslationKey;
}

/**
 * Helper to get the i18n label key for a message category.
 */
export function getMessageCategoryLabelKey(category: string): AppTranslationKey {
  return `messaging.category.${category}` as AppTranslationKey;
}

/** Standardized messaging recipient object interface. */
export interface StandardMessagingRecipient extends PersonalizeRecipient {
  id: string | number;
  name: string;
  phone: string;
  email?: string;
}

/** Lean recipient DTO for messaging resolve / composer payloads. */
export const messagingRecipientSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  phone: z.string(),
  email: z.string().optional(),
});

/** POST /api/messaging/contacts/resolve response body. */
export const messagingResolveResponseSchema = z.object({
  recipients: z.array(messagingRecipientSchema),
});

/** Inferred lean recipient from Zod (matches StandardMessagingRecipient). */
export type MessagingRecipientDto = z.infer<typeof messagingRecipientSchema>;
/** Resolve endpoint response DTO. */
export type MessagingResolveResponseDto = z.infer<typeof messagingResolveResponseSchema>;

/**
 * Converts a contact or entity object into a standardized StandardMessagingRecipient payload.
 */
export function toMessagingRecipient<
  T extends {
    id: string | number;
    name?: string;
    phone?: string;
    email?: string;
    phones?: { number: string; isPrimary?: boolean }[];
    emails?: { address: string; isPrimary?: boolean }[];
  },
>(
  contact: T,
  getters?: {
    getDisplayName?: (item: T) => string;
    getPrimaryPhone?: (item: T) => string | null | undefined;
    getPrimaryEmail?: (item: T) => string | null | undefined;
  },
): StandardMessagingRecipient {
  const name = getters?.getDisplayName
    ? getters.getDisplayName(contact)
    : contact.name || String(contact.id);

  let phone = getters?.getPrimaryPhone ? getters.getPrimaryPhone(contact) : contact.phone;
  if (!phone && Array.isArray(contact.phones) && contact.phones.length > 0) {
    phone = contact.phones.find((p) => p.isPrimary)?.number || contact.phones[0]?.number;
  }

  let email = getters?.getPrimaryEmail ? getters.getPrimaryEmail(contact) : contact.email;
  if (!email && Array.isArray(contact.emails) && contact.emails.length > 0) {
    email = contact.emails.find((e) => e.isPrimary)?.address || contact.emails[0]?.address;
  }

  return {
    id: contact.id,
    name,
    phone: phone || "",
    email: email || "",
  };
}

export function isMessageLogDeleted(log: { deletedAt?: string | null }): boolean {
  return Boolean(log.deletedAt);
}

export function filterActiveMessageLogs<T extends { deletedAt?: string | null }>(logs: T[]): T[] {
  return logs.filter((log) => !isMessageLogDeleted(log));
}
