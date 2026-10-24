import type React from "react";
import { useState } from "react";
import { Users } from "lucide-react";
import ContactEditModal from "@/components/contactLink/ContactEditModal";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/app/EmptyState";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import {
  CONTACTS_MODULE_MANIFEST,
  getPrimaryPhone,
  listStudentContactRelationships,
  type Contact,
  type Student,
} from "@mms/shared";
import { formatLocalizedRelationshipParts } from "@/lib/contacts/formatLocalizedRelationshipLabel";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { GuardianContactCard } from "@/tenant/features/students/components/GuardianContactCard";
import { relationshipBadgeCode } from "@/tenant/features/students/lib/guardianRelationshipBadge";
import { useContactsByIds } from "@/tenant/hooks/collections/contacts";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";

export interface StudentGuardianSectionProps {
  formInstanceId: string;
  studentDraft: Partial<Student>;
  linkedContact?: Contact | null;
  isFieldEnabled: (fieldId: string) => boolean;
}

export function StudentGuardianSection({
  formInstanceId,
  studentDraft,
  linkedContact,
  isFieldEnabled,
}: StudentGuardianSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { canWrite: canWriteContacts } = useModulePermissions(CONTACTS_MODULE_MANIFEST);
  const [editContactOpen, setEditContactOpen] = useState(false);

  const canOpenContactEditor = Boolean(linkedContact?.id) && canWriteContacts;

  const showRelationships = isFieldEnabled("contactRelationships");
  const links = listStudentContactRelationships(linkedContact ?? null);
  const relatedIds = links.map((link) => link.contactId).filter(Boolean) as string[];
  const { data: relatedContacts = [] } = useContactsByIds(showRelationships ? relatedIds : []);
  const byId = new Map(relatedContacts.map((contact) => [String(contact.id), contact]));

  if (!showRelationships) {
    return null;
  }

  const hasAnyLink = links.length > 0;

  return (
    <div className="space-y-6" id={`sf-${formInstanceId}-guardians`} tabIndex={-1}>
      <SectionCard
        title={t("students.form.guardiansSection")}
        subtitle={t("students.form.guardiansSectionDesc")}
        icon={Users}
        accentColor="info"
      >
        {!studentDraft.contactId ? (
          <EmptyState compact icon={Users} title={t("students.form.guardiansNeedContact")} />
        ) : !hasAnyLink ? (
          <div className="space-y-3">
            <EmptyState
              compact
              icon={Users}
              title={t("students.form.guardiansFromContactsEmpty")}
              action={
                canOpenContactEditor ? (
                  <Button
                    type="button"
                    variant="outline"
                    className="min-h-11"
                    onClick={() => setEditContactOpen(true)}
                  >
                    {t("students.form.guardiansEditContactCta")}
                  </Button>
                ) : undefined
              }
            />
            {!canOpenContactEditor ? (
              <p className="text-xs text-muted-foreground text-center">
                {t("students.form.guardiansEditOnContact")}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {links.map((link, index) => {
              const contact = link.contactId ? byId.get(String(link.contactId)) : undefined;
              const name =
                contact?.name || link.name || (link.contactId ? t("common.loading") : undefined);
              if (!name) return null;
              const phone = contact
                ? getPrimaryPhone(contact) || undefined
                : link.phone || undefined;
              const emptyDash = t("students.table.emptyDash");
              const gender = contact?.gender ?? link.gender;
              const { display, label } = formatLocalizedRelationshipParts(
                link.relationship,
                gender,
                t,
              );
              return (
                <GuardianContactCard
                  key={`${link.relationship}-${link.contactId ?? name}-${index}`}
                  label={label}
                  badgeCode={relationshipBadgeCode(display, emptyDash)}
                  badgeTone={SEMANTIC_BADGE.infoStrong}
                  name={name}
                  phone={phone || undefined}
                />
              );
            })}
          </div>
        )}
        {studentDraft.contactId && hasAnyLink ? (
          <div className="mt-3">
            {canOpenContactEditor ? (
              <Button
                type="button"
                variant="ghost"
                className="min-h-11 px-0 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => setEditContactOpen(true)}
              >
                {t("students.form.guardiansEditContactCta")}
              </Button>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t("students.form.guardiansEditOnContact")}
              </p>
            )}
          </div>
        ) : null}
      </SectionCard>

      <ContactEditModal
        open={editContactOpen}
        contact={linkedContact}
        onClose={() => setEditContactOpen(false)}
      />
    </div>
  );
}
