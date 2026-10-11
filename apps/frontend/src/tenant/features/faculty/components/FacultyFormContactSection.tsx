import type React from "react";
import { GraduationCap, Mail, Phone, School, User } from "lucide-react";
import ContactPicker from "@/components/contactLink/ContactPicker";
import { SectionCard } from "@/components/ui/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import {
  getContactQualification,
  getContactSpecialization,
  getPrimaryEmail,
  getPrimaryPhone,
  type Contact,
  type FacultyMember,
  type FieldDefinition,
} from "@mms/shared";
import { resolveFacultyFieldLabel } from "@/tenant/features/faculty/components/FacultyFormSectionShared";
import { FacultyContactBackgroundSection } from "@/tenant/features/faculty/components/FacultyContactBackgroundSection";

export interface FacultyContactSectionProps {
  facultyDraft?: Partial<FacultyMember>;
  linkedContact?: Contact | null;
  linkedFacultyContactIds?: Array<string | number>;
  errors: Record<string, string>;
  fields: Record<string, FieldDefinition[]>;
  isFieldEnabled: (fieldId: string) => boolean;
  isFieldRequired: (fieldId: string) => boolean;
  onDraftChange: (patch: Partial<FacultyMember>) => void;
}

/** Contacts card: contact dropdown (+ read-only contact pills after link). */
export function FacultyContactSection(props: FacultyContactSectionProps): React.JSX.Element | null {
  const {
    facultyDraft = {},
    errors,
    fields,
    linkedContact,
    linkedFacultyContactIds = [],
    isFieldEnabled,
    isFieldRequired,
    onDraftChange,
  } = props;
  const { t } = useTranslation();
  const showContact = isFieldEnabled("contactId");
  const primaryPhone = linkedContact ? getPrimaryPhone(linkedContact) : null;
  const primaryEmail = linkedContact ? getPrimaryEmail(linkedContact) : null;
  const contactQualification = linkedContact ? getContactQualification(linkedContact) : "";
  const contactSpecialization = linkedContact ? getContactSpecialization(linkedContact) : "";
  const hasProfilePills =
    Boolean(facultyDraft.contactId) &&
    (Boolean(primaryPhone) ||
      Boolean(primaryEmail) ||
      Boolean(contactQualification) ||
      Boolean(contactSpecialization));

  if (!showContact && !hasProfilePills && !linkedContact) return null;

  return (
    <SectionCard
      title={t("faculty.form.tab.contact")}
      icon={User}
      accentColor="primary"
      className="z-sticky"
    >
      <div className="space-y-3">
        {showContact && (
          <ContactPicker
            id="contactId"
            name="contactId"
            label={resolveFacultyFieldLabel(fields, "basic", "contactId", t)}
            value={facultyDraft.contactId ? String(facultyDraft.contactId) : null}
            onChange={(contactId) =>
              onDraftChange({ contactId: contactId ? String(contactId) : "" })
            }
            excludeIds={linkedFacultyContactIds.map(String)}
            searchPlaceholder={t("faculty.form.searchContact")}
            emptyTitle={t("faculty.form.noContacts")}
            emptyHint={t("faculty.form.noContactsHint")}
            required={isFieldRequired("contactId")}
            error={!!errors.contactId}
            errorMessage={errors.contactId}
          />
        )}
        {hasProfilePills && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-border/40">
            {primaryPhone && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-xs text-muted-foreground font-medium">
                <Phone className="w-3.5 h-3.5 text-primary" aria-hidden />
                <span>{primaryPhone}</span>
              </div>
            )}
            {primaryEmail && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-xs text-muted-foreground font-medium">
                <Mail className="w-3.5 h-3.5 text-primary" aria-hidden />
                <span>{primaryEmail}</span>
              </div>
            )}
            {contactQualification && (
              <div
                data-testid="faculty-contact-qualification-pill"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-xs text-muted-foreground font-medium"
                title={t("faculty.field.qualification")}
              >
                <GraduationCap className="w-3.5 h-3.5 text-primary" aria-hidden />
                <span>{contactQualification}</span>
              </div>
            )}
            {contactSpecialization && (
              <div
                data-testid="faculty-contact-specialization-pill"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/60 text-xs text-muted-foreground font-medium"
                title={t("faculty.field.specialization")}
              >
                <School className="w-3.5 h-3.5 text-primary" aria-hidden />
                <span>{contactSpecialization}</span>
              </div>
            )}
          </div>
        )}
        {linkedContact && <FacultyContactBackgroundSection contact={linkedContact} />}
      </div>
    </SectionCard>
  );
}
