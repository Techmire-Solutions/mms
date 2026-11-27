import { useMemo } from "react";
import {
  canViewContactField,
  DEFAULT_GLOBAL_SETTINGS,
  formatIsoDateToDisplay,
  getPrimaryAddress,
  type Contact,
  type DateFormatId,
  type FieldDefinition as RegistryFieldDefinition,
} from "@mms/contracts";
import type { EntityDescriptor } from "@mms/fe-core/components/entityRegistryTypes";
import { createEntityDescriptorFromFieldConfig } from "@mms/fe-core/lib/entityDescriptorFromFieldConfig";
import { useContactConfig } from "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext";
import { useOptionalAuth } from "@mms/fe-core/auth/AuthContext";
import { useTranslation } from "@mms/fe-core/i18n";
import { formatContactGenderLabel, resolveRegistryLabel } from "@mms/fe-core/lib/contactI18n";
import { SEMANTIC_BADGE } from "@mms/fe-core/ui/semanticTone";

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
        fieldsByTab: fields ?? {},
        resolveLabel: (field: RegistryFieldDefinition) => resolveRegistryLabel(field, t),
        canViewField: (field: RegistryFieldDefinition) => canViewContactField(viewerRole, field),
        fieldOverrides: {
          // Hero/face chrome is rendered by ContactCardHeader / ContactCardInfoPills.
          name: { cardSlot: "hidden" },
          phone: { cardSlot: "hidden" },
          email: { cardSlot: "hidden" },
          city: {
            formatValue: (_raw, entity) => getPrimaryAddress(entity)?.city || entity.city || "—",
          },
          state: {
            formatValue: (_raw, entity) => getPrimaryAddress(entity)?.state || entity.state || "—",
          },
          country: {
            formatValue: (_raw, entity) =>
              getPrimaryAddress(entity)?.country || entity.country || "—",
          },
          line1: {
            formatValue: (_raw, entity) => getPrimaryAddress(entity)?.line1 || entity.line1 || "—",
          },
          dob: {
            formatValue: (raw) => {
              if (!raw) return "—";
              const iso = String(raw).slice(0, 10);
              return (
                formatIsoDateToDisplay(iso, DEFAULT_GLOBAL_SETTINGS.dateFormat as DateFormatId) ||
                iso
              );
            },
          },
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
