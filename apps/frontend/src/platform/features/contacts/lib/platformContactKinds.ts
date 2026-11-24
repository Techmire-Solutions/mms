import type { AppTranslationKey } from "@mms/shared";

export const PLATFORM_CONTACT_KINDS = ["platform_operator", "workspace_admin", "external"] as const;
export type PlatformContactKind = (typeof PLATFORM_CONTACT_KINDS)[number];

export const PLATFORM_CONTACT_KIND_LABEL_KEYS: Record<PlatformContactKind, AppTranslationKey> = {
  platform_operator: "platform.contacts.kind.platform_operator",
  workspace_admin: "platform.contacts.kind.workspace_admin",
  external: "platform.contacts.kind.external",
};
