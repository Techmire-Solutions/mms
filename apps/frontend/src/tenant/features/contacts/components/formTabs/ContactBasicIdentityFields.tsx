import React, { useMemo } from "react";
import { User } from "lucide-react";
import { EditableSelect, Field } from "@/components/app/FormPrimitives";
import { LeadingIconInput } from "@/components/app/LeadingIconInput";
import { useTranslation } from "@/hooks/useTranslation";
import { formatContactGenderLabel } from "@/lib/contacts/contactI18n";
import type { Contact } from "@mms/shared";
import { ContactBasicMetaFields } from "@/tenant/features/contacts/components/formTabs/ContactBasicMetaFields";
import { GenderIcon } from "@/components/app/GenderIcon";

export interface ContactBasicIdentityFieldsProps {
  contactDraft: Partial<Contact>;
  formInstanceId: string;
  isFieldEnabled: (tabId: string, fieldId: string) => boolean;
  isFieldRequired: (tabId: string, fieldId: string) => boolean;
  getFieldError: (fieldId: string) => string | undefined;
  updateDraft: (patch: Partial<Contact>) => void;
  genders?: string[];
  onUpdateGenders?: (genders: string[]) => void;
  tags?: string[];
  onUpdateTags?: (tags: string[]) => void;
  lockGender: boolean;
}

export function ContactBasicIdentityFields({
  contactDraft,
  formInstanceId,
  isFieldEnabled,
  isFieldRequired,
  getFieldError,
  updateDraft,
  genders,
  onUpdateGenders,
  tags,
  onUpdateTags,
  lockGender,
}: ContactBasicIdentityFieldsProps): React.JSX.Element {
  const { t } = useTranslation();

  const genderOptions = useMemo(() => {
    const list = genders && genders.length > 0 ? genders : ["male", "female"];
    return list.map((g) => g.trim()).filter(Boolean);
  }, [genders]);

  return (
    <div className="grid grid-cols-1 gap-4 @md:grid-cols-2">
      {isFieldEnabled("basic", "firstName") && (
        <Field
          label={t("contacts.fields.firstName")}
          required={isFieldRequired("basic", "firstName")}
          error={getFieldError("firstName")}
          id={`cf-${formInstanceId}-firstName`}
        >
          <LeadingIconInput
            icon={User}
            id={`cf-${formInstanceId}-firstName`}
            name="firstName"
            autoComplete="given-name"
            autoCapitalize="words"
            enterKeyHint="next"
            value={contactDraft.firstName || ""}
            onChange={(e) => updateDraft({ firstName: e.target.value })}
            placeholder={t("contacts.fields.firstName")}
          />
        </Field>
      )}

      {isFieldEnabled("basic", "lastName") && (
        <Field
          label={t("contacts.fields.lastName")}
          required={isFieldRequired("basic", "lastName")}
          error={getFieldError("lastName")}
          id={`cf-${formInstanceId}-lastName`}
        >
          <LeadingIconInput
            icon={User}
            id={`cf-${formInstanceId}-lastName`}
            name="lastName"
            autoComplete="family-name"
            autoCapitalize="words"
            enterKeyHint="next"
            value={contactDraft.lastName || ""}
            onChange={(e) => updateDraft({ lastName: e.target.value })}
            placeholder={t("contacts.fields.lastName")}
          />
        </Field>
      )}

      {isFieldEnabled("basic", "gender") && (
        <Field
          label={t("contacts.fields.gender")}
          required={isFieldRequired("basic", "gender")}
          error={getFieldError("gender")}
          id={`cf-${formInstanceId}-gender`}
        >
          {lockGender ? (
            <div className="flex min-h-11 w-full items-center gap-2 rounded-xl border border-border bg-muted/40 px-3.5 text-xs text-muted-foreground select-none font-semibold">
              {contactDraft.gender ? (
                <>
                  <GenderIcon gender={contactDraft.gender} className="w-3.5 h-3.5" />
                  {formatContactGenderLabel(contactDraft.gender, t)}
                </>
              ) : (
                t("contacts.gender.unspecified")
              )}
            </div>
          ) : (
            <EditableSelect
              id={`cf-${formInstanceId}-gender`}
              name={`cf-${formInstanceId}-gender`}
              options={genderOptions}
              value={contactDraft.gender || ""}
              onChange={(val) => updateDraft({ gender: val.trim() ? val : undefined })}
              onUpdateOptions={onUpdateGenders}
              placeholder={t("contacts.form.selectOption")}
              className="w-full"
            />
          )}
        </Field>
      )}

      <ContactBasicMetaFields
        contactDraft={contactDraft}
        formInstanceId={formInstanceId}
        isFieldEnabled={isFieldEnabled}
        isFieldRequired={isFieldRequired}
        getFieldError={getFieldError}
        updateDraft={updateDraft}
        tags={tags}
        onUpdateTags={onUpdateTags}
      />
    </div>
  );
}
