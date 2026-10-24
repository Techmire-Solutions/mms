import React from "react";
import { Award, School } from "lucide-react";
import type { Faculty, FacultySettings } from "@mms/shared";
import { resolveRoleDisplayName } from "@mms/shared";
import { Badge } from "@/components/ui/badge";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveRegistryLabel } from "@/lib/contacts/contactI18n";
import { facultyMessagingLabels } from "@/lib/faculty/facultyMessagingLabels";
import type { FacultyDetailFieldRow } from "@/tenant/features/faculty/lib/facultyDetailFields";
import { resolveFacultyFieldDisplayText } from "@/tenant/features/faculty/lib/facultyFieldDisplay";
import {
  resolveFacultyTabLabel,
  SYSTEM_FIELD_ICONS,
} from "@/tenant/features/faculty/lib/facultyDetailShared";
import { buildFacultyContactRows } from "@/tenant/features/faculty/components/facultyDetailContactRows";
import { useWorkspaceRoles } from "@/tenant/hooks/useWorkspaceRoles";

export interface FacultyDetailFieldsSectionProps {
  faculty: Faculty;
  detailFields: FacultyDetailFieldRow[];
  displayName: string;
  settings: FacultySettings;
}

export function FacultyDetailFieldsSection({
  faculty,
  detailFields,
  displayName,
  settings,
}: FacultyDetailFieldsSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const workspaceRoles = useWorkspaceRoles();
  const emptyDash = t("faculty.table.emptyDash");
  const messagingLabels = facultyMessagingLabels(t);

  const rowForField = (field: FacultyDetailFieldRow): React.ReactNode => {
    const label = resolveRegistryLabel(field, t);
    const icon = field.isCustom ? School : (SYSTEM_FIELD_ICONS[field.key] ?? School);
    const displayValue = resolveFacultyFieldDisplayText(faculty, field.key, {
      t,
      displayName,
      customFieldLabel: field.label,
      customFieldType: field.type,
      isCustom: field.isCustom,
    });
    // For the designation field, also surface the assignable roles of the current designation.
    const assignableRoles: string[] =
      field.key === "designation"
        ? (((faculty as Record<string, unknown>).designationAssignableRoles as
            string[] | undefined) ?? [])
        : [];
    return (
      <React.Fragment key={field.key}>
        <DetailAttributeRow
          variant="inset"
          icon={icon}
          label={label}
          value={displayValue || emptyDash}
        />
        {assignableRoles.length > 0 && (
          <DetailAttributeRow
            variant="inset"
            icon={Award}
            label={t("faculty.designations.role")}
            value={
              <div className="flex flex-wrap gap-1">
                {assignableRoles.map((role) => (
                  <Badge key={role} variant="outline" className="text-xs font-normal">
                    {resolveRoleDisplayName(role, workspaceRoles, t)}
                  </Badge>
                ))}
              </div>
            }
          />
        )}
      </React.Fragment>
    );
  };

  const contactRows = buildFacultyContactRows({
    faculty,
    displayName,
    t,
    emptyDash,
    messagingLabels,
  });

  const byTab = new Map<string, FacultyDetailFieldRow[]>();
  const order: string[] = [];
  for (const field of detailFields) {
    if (field.key === "status" || field.key === "notes") continue;
    let list = byTab.get(field.tab);
    if (!list) {
      list = [];
      byTab.set(field.tab, list);
      order.push(field.tab);
    }
    list.push(field);
  }

  const basicTabId = "basic";
  if (contactRows.length > 0 && !order.includes(basicTabId)) order.unshift(basicTabId);

  const sections = order.map((tabId) => {
    const rows: React.ReactNode[] = (byTab.get(tabId) ?? []).map(rowForField);
    if (tabId === basicTabId) rows.push(...contactRows);
    if (rows.length === 0) return null;
    return (
      <DetailSectionCard
        key={tabId}
        title={resolveFacultyTabLabel(settings, tabId, t)}
        className="divide-y divide-border/50 p-0"
      >
        {rows}
      </DetailSectionCard>
    );
  });

  if (sections.every((section) => section == null)) return null;

  return <>{sections}</>;
}
