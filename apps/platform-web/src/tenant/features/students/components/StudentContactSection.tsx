import { Calendar, Mail, Phone, User } from "lucide-react";
import ContactPicker from "@/components/contactLink/ContactPicker";
import { DatePicker } from "@mms/fe-core/components/DatePicker";
import { Field } from "@mms/ui/app/FormField";
import { SectionCard } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { cn } from "@mms/ui";
import { getGenderIcon, getGenderIconClass } from "@mms/ui/app/genderUi";
import {
  getPrimaryEmail,
  getPrimaryPhone,
  todayISO,
  type Contact,
  type FieldDefinition,
} from "@mms/contracts";
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
  rawDob?: string;
  genderError?: string;
  dobError?: string;
  fields: Record<string, FieldDefinition[]>;
  isFieldEnabled: (fieldId: string) => boolean;
  isFieldRequired: (fieldId: string) => boolean;
  getFieldError: StudentFieldErrorGetter;
  onContactSelect: (id: string | number | null) => void;
  onStudentAvatarChange: (avatarUrl: string) => void | Promise<void>;
  onStudentDobChange?: (dob: string) => void | Promise<void>;
  formInstanceId?: string;
}

export function StudentContactSection({
  contactId,
  linkedContact,
  excludeIds,
  linkedGenderRaw,
  linkedGenderLabel,
  linkedDob,
  rawDob,
  genderError,
  dobError,
  fields,
  isFieldEnabled,
  isFieldRequired,
  getFieldError,
  onContactSelect,
  onStudentAvatarChange,
  onStudentDobChange,
  formInstanceId,
}: StudentContactSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const showContact = isFieldEnabled("contactId");
  const showGender = isFieldEnabled("gender");
  const showDob = isFieldEnabled("dob");
  const showPhone = isFieldEnabled("phone");
  const showEmail = isFieldEnabled("email");
  const primaryPhone = linkedContact ? getPrimaryPhone(linkedContact) : null;
  const primaryEmail = linkedContact ? getPrimaryEmail(linkedContact) : null;
  const showProfileRow =
    Boolean(contactId) &&
    (showGender ||
      showDob ||
      showPhone ||
      showEmail ||
      Boolean(primaryPhone) ||
      Boolean(primaryEmail));

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
  const phoneLabel = resolveStudentFieldLabel(fields, "basic", "phone", "students.fields.phone", t);
  const emailLabel = resolveStudentFieldLabel(fields, "basic", "email", "students.fields.email", t);

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
              {showPhone || primaryPhone ? (
                <ContactProfileValue
                  label={phoneLabel}
                  value={primaryPhone ?? ""}
                  icon={Phone}
                  error={getFieldError("phone")}
                />
              ) : null}
              {showEmail || primaryEmail ? (
                <ContactProfileValue
                  label={emailLabel}
                  value={primaryEmail ?? ""}
                  icon={Mail}
                  error={getFieldError("email")}
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
                onStudentDobChange ? (
                  <Field
                    label={dobLabel}
                    hint={t("students.form.contactFieldHint")}
                    error={dobError}
                    required={isFieldRequired("dob")}
                    id={`sf-${formInstanceId || "new"}-dob`}
                  >
                    <DatePicker
                      id={`sf-${formInstanceId || "new"}-dob`}
                      name="dob"
                      autoComplete="bday"
                      value={rawDob ?? linkedContact?.dob ?? undefined}
                      onChange={(dateStr) => {
                        void onStudentDobChange(dateStr);
                      }}
                      required={isFieldRequired("dob")}
                      max={todayISO()}
                      allowManualInput
                      className={cn(
                        dobError &&
                          "border-destructive focus-within:border-destructive focus-within:ring-destructive",
                      )}
                    />
                  </Field>
                ) : (
                  <ContactProfileValue
                    label={dobLabel}
                    value={linkedDob}
                    icon={Calendar}
                    error={dobError}
                  />
                )
              ) : null}
            </div>
          ) : null}
        </div>
      </SectionCard>
    </div>
  );
}
