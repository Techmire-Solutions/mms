import type { PlatformSettings } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { createEntityDescriptor } from "../entityDescriptorFactory";

export const platformSettingsEntityDescriptor: EntityDescriptor<PlatformSettings> =
  createEntityDescriptor<PlatformSettings>({
    entityType: "platformSettings",
    singularLabel: "Platform Setting",
    pluralLabel: "Platform Settings",
    idField: "id",
    titleField: "certbotEmail",
    fields: [
      {
        key: "certbotEmail",
        label: "Certbot Email",
        labelKey: "platform.descriptor.settings.certbotEmail",
        type: "email",
        defaultVisibleInTable: true,
        tableOrder: 10,
        fixed: true,
        cardSlot: "primary",
        drawerSection: "ssl",
        drawerOrder: 10,
      },
      {
        key: "syncTlsOnCreate",
        label: "Auto Sync TLS",
        labelKey: "platform.descriptor.settings.syncTlsOnCreate",
        type: "boolean",
        defaultVisibleInTable: true,
        tableOrder: 20,
        cardSlot: "badge",
        drawerSection: "ssl",
        drawerOrder: 20,
      },
      {
        key: "tlsExtraSans",
        label: "Extra SANs",
        labelKey: "platform.descriptor.settings.tlsExtraSans",
        type: "text",
        defaultVisibleInTable: true,
        tableOrder: 30,
        cardSlot: "secondary",
        drawerSection: "ssl",
        drawerOrder: 30,
      },
    ],
  });
