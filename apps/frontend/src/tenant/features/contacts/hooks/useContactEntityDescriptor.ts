import { useMemo } from "react";
import {
  canViewContactField,
  type Contact,
  type FieldDefinition as RegistryFieldDefinition,
} from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { createEntityDescriptorFromFieldConfig } from "@/components/common/entityDescriptorFromFieldConfig";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useOptionalAuth } from "@/lib/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { formatContactGenderLabel, resolveRegistryLabel } from "@/lib/contacts/contactI18n";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";

/** Contacts descriptor backed by the runtime FieldConfig — custom fields, permissions, i18n intact. */
export function useContactEntityDescriptor(): EntityDescriptor<Contact> {
  const { fields } = useContactConfig();
  const auth = useOptionalAuth();
  const { t } = useTranslation();
  const viewerRole = auth?.user?.role ?? "";

  return useMemo(
    () =>
      createEntityDescriptorFromFieldConfig<Contact>({
        entityType: "contacts",
        singularLabel: t("contacts.entity.singular"),
        pluralLabel: t("contacts.entity.plural"),
        idField: "id",
        titleField: "name",
        fieldsByTab: fields,
        resolveLabel: (field: RegistryFieldDefinition) => resolveRegistryLabel(field, t),
        canViewField: (field: RegistryFieldDefinition) => canViewContactField(viewerRole, field),
        fieldOverrides: {
          // Hero/face chrome is rendered by ContactCardHeader / ContactCardInfoPills.
          name: { cardSlot: "hidden" },
          phone: { cardSlot: "hidden" },
          email: { cardSlot: "hidden" },
          gender: {
            badgeVariantMap: {
              male: {
                label: formatContactGenderLabel("male", t),
                tone: "info",
                className: SEMANTIC_BADGE.info,
              },
              female: {
                label: formatContactGenderLabel("female", t),
                tone: "secondary",
                className: SEMANTIC_BADGE.secondary,
              },
            },
          },
        },
      }),
    [fields, viewerRole, t],
  );
}
