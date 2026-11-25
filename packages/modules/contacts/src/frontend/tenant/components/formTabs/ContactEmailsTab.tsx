import type React from "react";
import { Mail } from "lucide-react";
import { CardPrimaryButton } from "@mms/fe-core/components/FormPrimitives";
import type { ContactSubListTabBaseProps } from "./types.js";
import { useTranslation } from "@mms/fe-core/i18n";
import { resolveEmailLabel } from "@mms/fe-core/lib/contactI18n";
import { ContactLabeledValueSubListTab } from "./ContactLabeledValueSubListTab.js";
import { isSubListItemPrimary } from "./ContactSubListCards.js";

export interface ContactEmailsTabProps extends ContactSubListTabBaseProps {
  emailLabels: string[];
  onUpdateEmailLabels: (labels: string[]) => void;
}

export function ContactEmailsTab({
  emailLabels,
  onUpdateEmailLabels,
  ...base
}: ContactEmailsTabProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <ContactLabeledValueSubListTab
      {...base}
      listKey="emails"
      labelFieldKey="label"
      valueFieldKey="address"
      valueLabel={t("contacts.fields.emailAddress")}
      options={emailLabels}
      onUpdateOptions={onUpdateEmailLabels}
      resolveLabel={(raw, options, translate) =>
        resolveEmailLabel(raw as string | undefined, options, translate)
      }
      emptyItem={(resolvedLabel) => ({
        id:
          typeof crypto !== "undefined" && crypto.randomUUID
            ? crypto.randomUUID()
            : `email-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        label: resolvedLabel,
        address: "",
      })}
      icon={Mail}
      emptyMessage={t("contacts.form.noEmailAddressesYet")}
      addLabel={t("contacts.form.addEmailAddress")}
      removeLabel={(index) => t("contacts.form.removeEmailAddress", { index })}
      valuePlaceholder={t("auth.emailAddress")}
      valueInputType="email"
      valueInputIdPrefix={`cf-${base.formInstanceId}-email-address`}
      labelSelectIdPrefix={`cf-${base.formInstanceId}-email-label`}
      autoComplete="email"
      inputMode="email"
      autoCapitalize="none"
      spellCheck={false}
      enterKeyHint="next"
      headerExtras={({ item, index }) => {
        const emails = base.contactDraft.emails || [];
        if (emails.length <= 1) return null;
        const isPrimary = isSubListItemPrimary(emails, item, index);
        return (
          <CardPrimaryButton
            isPrimary={isPrimary}
            onClick={() => base.setPrimarySubListItem?.("emails", index)}
            title={isPrimary ? t("contacts.form.primaryEmail") : t("contacts.form.setPrimary")}
            ariaLabel={isPrimary ? t("contacts.form.primaryEmail") : t("contacts.form.setPrimary")}
            primaryLabel={t("contacts.form.primary")}
            setPrimaryLabel={t("contacts.form.setPrimary")}
          />
        );
      }}
    />
  );
}
