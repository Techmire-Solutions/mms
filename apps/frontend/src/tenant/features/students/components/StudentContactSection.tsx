import { Calendar, Mail, Phone, User } from "lucide-react";
import ContactPicker from "@/components/contactLink/ContactPicker";
import { SectionCard } from "@/components/ui/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { getGenderIcon, getGenderIconClass } from "@/lib/genderUi";
import { getPrimaryEmail, getPrimaryPhone, type Contact, type FieldDefinition } from "@mms/shared";
import {
  ContactProfileValue,
  resolveStudentFieldLabel,
  type StudentFieldErrorGetter,
} from "@/tenant/features/students/components/StudentFormSectionShared";

export interface StudentContactSectionProps {
  contactId?: string | number | null;
  linkedContact?: Contact | null;
  excludeIds: string[];
  linkedGenderRaw?: string;
  linkedGenderLabel: string;
  linkedDob: string;
  genderError?: string;
  dobError?: string;
  fields: Record<string, FieldDefinition[]>;
  isFieldEnabled: (fieldId: string) => boolean;
  isFieldRequired: (fieldId: string) => boolean;
  getFieldError: StudentFieldErrorGetter;
  onContactSelect: (id: string | number | null) => void;
  onStudentAvatarChange: (avatarUrl: string) => void | Promise<void>;
}

export function StudentContactSection({
  contactId,
  linkedContact,
  excludeIds,
  linkedGenderRaw,
  linkedGenderLabel,
  linkedDob,
  genderError,
  dobError,
  fields,
  isFieldEnabled,
  isFieldRequired,
  getFieldError,
  onContactSelect,
  onStudentAvatarChange,
}: StudentContactSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const showContact = isFieldEnabled("contactId");
  const showGender = isFieldEnabled("gender");
  const showDob = isFieldEnabled("dob");
  const primaryPhone = linkedContact ? getPrimaryPhone(linkedContact) : null;
  const primaryEmail = linkedContact ? getPrimaryEmail(linkedContact) : null;
  const showProfileRow =
    Boolean(contactId) && (showGender || showDob || Boolean(primaryPhone) || Boolean(primaryEmail));

  if (!showContact && !showProfileRow) {
    return null;
  }

  const GenderGlyph = getGenderIcon(linkedGenderRaw);
  const contactLabel = resolveStudentFieldLabel(
    fields,
    "basic",
    "contactId",
    "students.form.contactLabel",
    t,
  );
  const genderLabel = resolveStudentFieldLabel(fields, "basic", "gender", "students.gender", t);
  const dobLabel = resolveStudentFieldLabel(fields, "basic", "dob", "students.form.fieldDob", t);

  return (
    <div className="space-y-6">
      <SectionCard
        title={t("students.form.contactLabel")}
        subtitle={t("students.form.contactHint")}
        icon={User}
        accentColor="primary"
      >
        <div className="space-y-4">
          {showContact ? (
            <ContactPicker
              label={contactLabel}
              value={contactId ? String(contactId) : null}
              onChange={onContactSelect}
              excludeIds={excludeIds}
              onAvatarChange={onStudentAvatarChange}
              searchPlaceholder={t("contacts.picker.searchPlaceholder")}
              emptyTitle={t("contacts.picker.emptyTitle")}
              emptyHint={t("contacts.picker.emptyHint")}
              required={isFieldRequired("contactId")}
              error={Boolean(getFieldError("contactId"))}
              errorMessage={getFieldError("contactId")}
              id="contactId"
            />
          ) : null}

          {showProfileRow ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/40">
              {primaryPhone ? (
                <ContactProfileValue
                  label={t("contacts.fields.phoneNumber")}
                  value={primaryPhone}
                  icon={Phone}
                />
              ) : null}
              {primaryEmail ? (
                <ContactProfileValue
                  label={t("contacts.fields.emailAddress")}
                  value={primaryEmail}
                  icon={Mail}
                />
              ) : null}
              {showGender ? (
                <ContactProfileValue
                  label={genderLabel}
                  value={linkedGenderLabel}
                  icon={GenderGlyph}
                  iconClassName={getGenderIconClass(linkedGenderRaw)}
                  error={genderError}
                />
              ) : null}
              {showDob ? (
                <ContactProfileValue
                  label={dobLabel}
                  value={linkedDob}
                  icon={Calendar}
                  error={dobError}
                />
              ) : null}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
