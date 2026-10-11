import React from "react";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { PersonDetailHeroCard } from "@/components/ui/PersonDetailHeroCard";
import { Badge } from "@/components/ui/badge";
import { getGenderCardAccent } from "@/lib/genderUi";
import { useTranslation } from "@/hooks/useTranslation";
import type { Student } from "@mms/shared";

export interface StudentDetailHeroCardProps {
  student: Student;
  statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
}

export function StudentDetailHeroCard({
  student,
  statusBadgeConfig,
}: StudentDetailHeroCardProps): React.JSX.Element {
  const { t } = useTranslation();
  const displayName = student.name?.trim() || "";
  const avatarUrl = typeof student.avatar === "string" ? student.avatar : undefined;

  return (
    <PersonDetailHeroCard
      id={String(student.id)}
      displayName={displayName}
      avatar={avatarUrl}
      gender={student.gender}
      accentColor={getGenderCardAccent(student.gender)}
    >
      <StatusBadge status={student.status || "active"} config={statusBadgeConfig} />
      {student.grNumber ? (
        <Badge
          as="span"
          size="sm"
          tone="primary"
          className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
        >
          {t("students.grPrefix")}: {student.grNumber}
        </Badge>
      ) : null}
    </PersonDetailHeroCard>
  );
}
