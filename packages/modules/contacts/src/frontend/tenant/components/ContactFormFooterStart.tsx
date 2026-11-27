import type React from "react";
import { getDisplayName, type AppTranslationKey, type Contact } from "@mms/contracts";
import type { useContactFormDraft } from "../hooks/useContactFormDraft";
import { FormFooterEntityChip, FormFooterErrorChip } from "@mms/ui/app/FormFooterChip";
import { Badge } from "@mms/ui";

type FormDraft = ReturnType<typeof useContactFormDraft>;

export interface ContactFormFooterStartProps {
  contactDraft: Partial<Contact>;
  collectionCounts: FormDraft["collectionCounts"];
  /** Editing an unchanged contact: explain why Save is disabled. */
  noChanges?: boolean;
  /** Setup Fields may disable the first-name control; then it must not explain a disabled Save. */
  requireFirstName?: boolean;
  /** Setup Fields may disable the gender control; then it must not explain a disabled Save. */
  requireGender?: boolean;
  t: (key: AppTranslationKey, params?: Record<string, string | number>) => string;
}

export function ContactFormFooterStart({
  contactDraft,
  collectionCounts,
  noChanges = false,
  requireFirstName = true,
  requireGender = true,
  t,
}: ContactFormFooterStartProps): React.JSX.Element {
  const missingFirstName = requireFirstName && !contactDraft.firstName?.trim();
  const missingGender = requireGender && !contactDraft.gender?.trim();
  if (missingFirstName && missingGender) {
    return <FormFooterErrorChip>{t("contacts.form.requiredFieldsHint")}</FormFooterErrorChip>;
  }
  if (missingFirstName) {
    return <FormFooterErrorChip>{t("contacts.form.firstNameRequired")}</FormFooterErrorChip>;
  }
  if (missingGender) {
    return <FormFooterErrorChip>{t("contacts.form.requiredFieldsHint")}</FormFooterErrorChip>;
  }

  const pluralize = (
    count: number,
    oneKey: AppTranslationKey,
    manyKey: AppTranslationKey,
  ): string => `${count} ${t(count === 1 ? oneKey : manyKey)}`;

  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      <FormFooterEntityChip>{getDisplayName(contactDraft)}</FormFooterEntityChip>
      {noChanges ? (
        <span className="text-muted-foreground">{t("contacts.form.noChanges")}</span>
      ) : null}
      <div className="flex flex-wrap items-center gap-1.5">
        {collectionCounts.filledPhones > 0 && (
          <Badge as="span" size="sm" tone="primary">
            {pluralize(
              collectionCounts.filledPhones,
              "contacts.form.countPhoneOne",
              "contacts.form.tabPhones",
            )}
          </Badge>
        )}
        {collectionCounts.filledEmails > 0 && (
          <Badge as="span" size="sm" tone="warning">
            {pluralize(
              collectionCounts.filledEmails,
              "contacts.form.countEmailOne",
              "contacts.form.tabEmails",
            )}
          </Badge>
        )}
        {collectionCounts.filledAddresses > 0 && (
          <Badge as="span" size="sm" tone="success">
            {pluralize(
              collectionCounts.filledAddresses,
              "contacts.form.countAddressOne",
              "contacts.form.tabAddresses",
            )}
          </Badge>
        )}
        {collectionCounts.filledSocials > 0 && (
          <Badge as="span" size="sm" tone="info">
            {pluralize(
              collectionCounts.filledSocials,
              "contacts.form.countSocialOne",
              "contacts.form.tabSocials",
            )}
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
            {pluralize(
              collectionCounts.filledSkills,
              "contacts.form.countSkillOne",
              "contacts.form.tabSkills",
            )}
          </Badge>
        )}
        {collectionCounts.filledRelationships > 0 && (
          <Badge as="span" size="sm" tone="destructive">
            {pluralize(
              collectionCounts.filledRelationships,
              "contacts.form.countRelationshipOne",
              "contacts.detail.relationships",
            )}
          </Badge>
        )}
        {collectionCounts.filledBankDetails > 0 && (
          <Badge as="span" size="sm" tone="primary">
            {pluralize(
              collectionCounts.filledBankDetails,
              "contacts.form.countBankDetailOne",
              "contacts.form.tabBankDetails",
            )}
          </Badge>
        )}
      </div>
    </div>
  );
}
