import React from "react";
import { Calendar, Clock, FileText } from "lucide-react";
import {
  type AppTranslationKey,
  type Student,
  OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS,
  STUDENT_DETAIL_HERO_FIELD_KEYS,
  formatDate,
  formatDateTime,
} from "@mms/shared";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import { formatContactGenderLabel, resolveRegistryLabel } from "@/lib/contacts/contactI18n";
import { getGenderIcon, getGenderIconClass } from "@/lib/ui/genderUi";
import { formatStudentsListContentCustomValue } from "@/tenant/features/students/lib/studentsListCustomColumns";

export interface SortedField {
  key: string;
  label: string;
  labelKey?: AppTranslationKey;
  type: string;
  tab: string;
  enabled: boolean;
  order: number;
  /** Detail drawer section title; unset fields fall back to extendedProfiles. */
  group: string;
}

export interface StudentDetailFieldsSectionProps {
  student: Student;
  sortedEnabledFields: SortedField[];
  age: number | null;
}

export function StudentDetailFieldsSection({
  student,
  sortedEnabledFields,
  age,
}: StudentDetailFieldsSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const emptyDash = t("students.table.emptyDash");

  const renderField = (field: SortedField): React.ReactNode => {
    if (
      STUDENT_DETAIL_HERO_FIELD_KEYS.has(field.key) ||
      OBSOLETE_STUDENT_GUARDIAN_FIELD_KEYS.has(field.key)
    ) {
      return null;
    }

    const fieldLabel = resolveRegistryLabel(field, t);

    if (field.key === "gender") {
      return (
        <DetailAttributeRow
          key="gender"
          variant="inset"
          icon={getGenderIcon(student.gender)}
          iconClassName={getGenderIconClass(student.gender)}
          label={fieldLabel}
          value={student.gender ? formatContactGenderLabel(student.gender, t) : emptyDash}
        />
      );
    }

    if (field.key === "dob") {
      return (
        <DetailAttributeRow
          key="dob"
          variant="inset"
          icon={Calendar}
          label={fieldLabel}
          value={`${student.dob ? formatDate(student.dob, true) : emptyDash} ${age ? t("students.list.ageYears", { age }) : ""}`}
        />
      );
    }

    if (field.key === "registeredDate") {
      return (
        <DetailAttributeRow
          key="registeredDate"
          variant="inset"
          icon={Clock}
          label={fieldLabel}
          value={student.registeredDate ? formatDateTime(student.registeredDate, true) : emptyDash}
        />
      );
    }

    if (field.key === "contactRelationships") {
      // Delegated to dedicated rich StudentDetailRelationsSection
      return null;
    }

    const rawValue =
      (student as Record<string, unknown>)[field.key] ??
      (student.customFields as Record<string, unknown> | undefined)?.[field.key];
    const displayValue = formatStudentsListContentCustomValue(rawValue, t, field.type);
    if (displayValue == null) return null;
    return (
      <DetailAttributeRow
        key={field.key}
        variant="inset"
        icon={FileText}
        label={fieldLabel}
        value={displayValue}
      />
    );
  };

  const groups = (() => {
    const order: string[] = [];
    const byGroup = new Map<string, SortedField[]>();
    for (const field of sortedEnabledFields) {
      let list = byGroup.get(field.group);
      if (!list) {
        list = [];
        byGroup.set(field.group, list);
        order.push(field.group);
      }
      list.push(field);
    }
    return order
      .map((group) => {
        const rows: React.ReactNode[] = [];
        for (const field of byGroup.get(group)!) {
          const node = renderField(field);
          if (node == null) continue;
          if (Array.isArray(node)) {
            rows.push(...node.filter((item) => item != null));
          } else {
            rows.push(node);
          }
        }
        return { group, rows };
      })
      .filter((entry) => entry.rows.length > 0);
  })();

  const ACCENT_COLORS = ["info", "warning", "success", "primary", "secondary"] as const;

  if (groups.length === 0) return null;

  return (
    <div className="space-y-4">
      {groups.map(({ group, rows }, index) => {
        const accent = ACCENT_COLORS[index % ACCENT_COLORS.length];
        return (
          <DetailSectionCard
            key={group}
            title={group}
            accentColor={accent}
            className="divide-y divide-border/50 p-0"
          >
            {rows}
          </DetailSectionCard>
        );
      })}
    </div>
  );
}
