import { useCallback, useMemo } from "react";
import {
  canViewContactField,
  CONTACTS_MODULE_MANIFEST,
  resolveRelationshipFieldsTabId,
  type Contact,
  type FieldDefinition,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  formatContactDobWithAge,
  formatContactGenderLabel,
  resolveRegistryLabel,
  resolveRegistryDescription,
} from "@/lib/contacts/contactI18n";
import { isEmptyValue } from "@/tenant/features/contacts/components/detail/contactDetailStyles";

export type DetailFieldView = {
  key: string;
  label: string;
  type: string;
  tab: string;
  group: string;
  description: string;
};

const HERO_FIELD_SET = new Set<string>(CONTACTS_MODULE_MANIFEST.heroFieldKeys);

function filterVisibleCollection(
  tabFields: FieldDefinition[] | undefined,
  viewerRole: string,
): FieldDefinition[] {
  return (tabFields || []).filter(
    (field) => field.enabled && canViewContactField(viewerRole, field),
  );
}

export function useContactDetailFields({
  fields,
  viewerRole,
  contactState,
  isTabFieldEnabled,
  t,
}: {
  fields: Record<string, FieldDefinition[]>;
  viewerRole: string;
  contactState: Contact;
  isTabFieldEnabled: (tabId: string, fieldId: string) => boolean;
  t: TranslationFunction;
}) {
  const allFields = useMemo((): DetailFieldView[] => {
    return Object.entries(fields).flatMap(([tabId, tabFields]) =>
      (tabFields || [])
        .filter((field) => canViewContactField(viewerRole, field))
        .map((field) => ({
          key: field.key,
          label: resolveRegistryLabel(field, t),
          type: field.type,
          tab: tabId,
          group: field.group || t("contacts.detail.extendedProfiles"),
          description: resolveRegistryDescription(field, t),
        })),
    );
  }, [fields, viewerRole, t]);

  const visibleCollectionFields = useMemo(() => {
    const relationshipTabId = resolveRelationshipFieldsTabId(fields) ?? "relationship";
    return {
      phones: filterVisibleCollection(fields.phones, viewerRole),
      emails: filterVisibleCollection(fields.emails, viewerRole),
      addresses: filterVisibleCollection(fields.addresses, viewerRole),
      socials: filterVisibleCollection(fields.socials, viewerRole),
      education: filterVisibleCollection(fields.education, viewerRole),
      experience: filterVisibleCollection(fields.experience, viewerRole),
      skills: filterVisibleCollection(fields.skills, viewerRole),
      bankDetails: filterVisibleCollection(fields.bankDetails, viewerRole),
      relationship: filterVisibleCollection(fields[relationshipTabId], viewerRole),
    };
  }, [fields, viewerRole]);

  const grouped = useMemo(() => {
    const fieldsToRender = allFields.filter(
      (field) =>
        !HERO_FIELD_SET.has(field.key) &&
        isTabFieldEnabled(field.tab, field.key) &&
        !isEmptyValue(contactState[field.key]),
    );
    return fieldsToRender.reduce<Record<string, DetailFieldView[]>>((acc, field) => {
      const group = field.group || t("contacts.detail.otherGroup");
      if (!acc[group]) acc[group] = [];
      acc[group].push(field);
      return acc;
    }, {});
  }, [allFields, isTabFieldEnabled, contactState, t]);

  const formatFieldValue = useCallback(
    (field: { key: string; type: string }): string | null => {
      const fieldValue = contactState[field.key];
      if (isEmptyValue(fieldValue)) return null;
      if (Array.isArray(fieldValue)) return fieldValue.join(", ");
      if (field.key === "dob") {
        return formatContactDobWithAge(fieldValue as string, t);
      }
      if (field.key === "gender") {
        return formatContactGenderLabel(fieldValue as string, t);
      }
      if (typeof fieldValue === "boolean") {
        return fieldValue ? t("common.yes") : t("common.no");
      }
      return String(fieldValue);
    },
    [contactState, t],
  );

  return {
    grouped,
    formatFieldValue,
    visibleCollectionFields,
  };
}
