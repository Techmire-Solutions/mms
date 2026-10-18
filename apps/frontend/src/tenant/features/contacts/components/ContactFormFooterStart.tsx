import type React from "react";
import { getDisplayName, type AppTranslationKey, type Contact } from "@mms/shared";
import type { useContactFormDraft } from "@/tenant/features/contacts/hooks/useContactFormDraft";
import { FormFooterEntityChip, FormFooterErrorChip } from "@/components/app/FormFooterChip";
import { Badge } from "@/components/ui/badge";

type FormDraft = ReturnType<typeof useContactFormDraft>;

export interface ContactFormFooterStartProps {
  contactDraft: Partial<Contact>;
  collectionCounts: FormDraft["collectionCounts"];
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
}

export function ContactFormFooterStart({
  contactDraft,
  collectionCounts,
  t,
}: ContactFormFooterStartProps): React.JSX.Element {
  if (!contactDraft.firstName?.trim()) {
    return <FormFooterErrorChip>{t("contacts.form.firstNameRequired")}</FormFooterErrorChip>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      <FormFooterEntityChip>{getDisplayName(contactDraft)}</FormFooterEntityChip>
      <div className="flex flex-wrap items-center gap-1.5">
        {collectionCounts.filledPhones > 0 && (
          <Badge as="span" size="sm" tone="primary">
            {collectionCounts.filledPhones} {t("contacts.form.tabPhones")}
          </Badge>
        )}
        {collectionCounts.filledEmails > 0 && (
          <Badge as="span" size="sm" tone="warning">
            {collectionCounts.filledEmails} {t("contacts.form.tabEmails")}
          </Badge>
        )}
        {collectionCounts.filledAddresses > 0 && (
          <Badge as="span" size="sm" tone="success">
            {collectionCounts.filledAddresses} {t("contacts.form.tabAddresses")}
          </Badge>
        )}
        {collectionCounts.filledSocials > 0 && (
          <Badge as="span" size="sm" tone="info">
            {collectionCounts.filledSocials} {t("contacts.form.tabSocials")}
          </Badge>
        )}
        {collectionCounts.filledEducation > 0 && (
          <Badge as="span" size="sm" tone="info">
            {collectionCounts.filledEducation} {t("contacts.form.tabEducation")}
          </Badge>
        )}
        {collectionCounts.filledExperience > 0 && (
          <Badge as="span" size="sm" tone="muted">
            {collectionCounts.filledExperience} {t("contacts.form.tabExperience")}
          </Badge>
        )}
        {collectionCounts.filledSkills > 0 && (
          <Badge as="span" size="sm" tone="success">
            {collectionCounts.filledSkills} {t("contacts.form.tabSkills")}
          </Badge>
        )}
        {collectionCounts.filledRelationships > 0 && (
          <Badge as="span" size="sm" tone="destructive">
            {collectionCounts.filledRelationships} {t("contacts.detail.relationships")}
          </Badge>
        )}
        {collectionCounts.filledBankDetails > 0 && (
          <Badge as="span" size="sm" tone="primary">
            {collectionCounts.filledBankDetails} {t("contacts.form.tabBankDetails")}
          </Badge>
        )}
      </div>
    </div>
  );
}
