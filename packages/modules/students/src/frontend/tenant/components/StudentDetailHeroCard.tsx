import React from "react";
import { StatusBadge, type StatusBadgeConfigItem } from "@mms/fe-core/components/StatusBadge";
import { PersonDetailHeroCard } from "@mms/fe-core/components/PersonDetailHeroCard";
import { Badge } from "@mms/ui";
import { getGenderCardAccent } from "@mms/ui/app/genderUi";
import type { Student } from "@mms/contracts";

export interface StudentDetailHeroCardProps {
  student: Student;
  statusBadgeConfig: Record<string, StatusBadgeConfigItem>;
}

export function StudentDetailHeroCard({
  student,
  statusBadgeConfig,
}: StudentDetailHeroCardProps): React.JSX.Element {
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
          {student.grNumber}
        </Badge>
      ) : null}
    </PersonDetailHeroCard>
  );
}
