import type React from "react";
import type { Contact, FacultyMember } from "@mms/shared";
import { resolveFacultyStatus } from "@mms/shared";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import { Alert } from "@/components/app/Alert";
import { FormFooterEntityChip } from "@/components/app/FormFooterChip";
import { Badge } from "@/components/ui/badge";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { extractEmployeeId } from "@/tenant/features/faculty/lib/facultyFormDraft";

export interface FacultyFormFooterProps {
  linkedContact?: Contact | null;
  facultyDraft?: Partial<FacultyMember>;
  requireContactLink: boolean;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  t: TranslationFunction;
}

export function FacultyFormFooter({
  linkedContact,
  facultyDraft = {},
  requireContactLink,
  statusConfig,
  t,
}: FacultyFormFooterProps): React.JSX.Element | null {
  if (linkedContact?.name) {
    const status = resolveFacultyStatus(facultyDraft.status);
    const employeeId = extractEmployeeId(facultyDraft.employeeId);
    return (
      <div className="flex flex-wrap items-center gap-2.5 text-xs">
        <FormFooterEntityChip>{linkedContact.name}</FormFooterEntityChip>
        <div className="flex items-center gap-1.5">
          <Badge as="span" tone="primary" size="sm">
            {t("faculty.form.employeeIdBadge", { id: employeeId || t("common.notSpecified") })}
          </Badge>
          <StatusBadge status={status} config={statusConfig} size="sm" />
        </div>
      </div>
    );
  }

  if (requireContactLink && !facultyDraft.contactId) {
    return (
      <Alert tone="destructive" density="compact" description={t("faculty.form.contactRequired")} />
    );
  }

  return null;
}
