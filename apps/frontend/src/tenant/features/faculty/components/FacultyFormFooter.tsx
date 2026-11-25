import type React from "react";
import type { Contact, FacultyMember } from "@mms/contracts";
import { resolveFacultyStatus } from "@mms/contracts";
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
  missingRequiredPhone?: boolean;
  missingRequiredEmail?: boolean;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  t: TranslationFunction;
}

export function FacultyFormFooter({
  linkedContact,
  facultyDraft = {},
  requireContactLink,
  missingRequiredPhone = false,
  missingRequiredEmail = false,
  statusConfig,
  t,
}: FacultyFormFooterProps): React.JSX.Element | null {
  const hasChip = Boolean(linkedContact?.name);
  const showContactRequired = requireContactLink && !facultyDraft.contactId;
  if (!hasChip && !showContactRequired && !missingRequiredPhone && !missingRequiredEmail) {
    return null;
  }

  return (
    <div className="flex flex-col gap-2 text-xs">
      {hasChip ? (
        <div className="flex flex-wrap items-center gap-2.5">
          <FormFooterEntityChip>{linkedContact?.name}</FormFooterEntityChip>
          <div className="flex items-center gap-1.5">
            <Badge as="span" tone="primary" size="sm">
              {t("faculty.form.employeeIdBadge", {
                id: extractEmployeeId(facultyDraft.employeeId) || t("common.notSpecified"),
              })}
            </Badge>
            <StatusBadge
              status={resolveFacultyStatus(facultyDraft.status)}
              config={statusConfig}
              size="sm"
            />
          </div>
        </div>
      ) : null}
      {showContactRequired ? (
        <Alert
          tone="destructive"
          density="compact"
          description={t("faculty.form.contactRequired")}
        />
      ) : null}
      {missingRequiredPhone ? (
        <Alert
          tone="destructive"
          density="compact"
          description={t("faculty.form.contactPhoneRequired")}
        />
      ) : null}
      {missingRequiredEmail ? (
        <Alert
          tone="destructive"
          density="compact"
          description={t("faculty.form.contactEmailRequired")}
        />
      ) : null}
    </div>
  );
}
