import React from "react";
import { StatusBadge, type StatusBadgeConfigItem } from "@/components/ui/StatusBadge";
import { PersonDetailHeroCard } from "@/components/ui/PersonDetailHeroCard";
import { Badge } from "@/components/ui/badge";
import { getGenderCardAccent } from "@/lib/genderUi";
import { useTranslation } from "@/hooks/useTranslation";
import { resolveFacultyStatus, type Faculty } from "@mms/shared";

export interface FacultyDetailHeroCardProps {
  faculty: Faculty;
  displayName: string;
  avatar?: string | null;
  statusConfig: Record<string, StatusBadgeConfigItem>;
  showStatus: boolean;
}

export function FacultyDetailHeroCard({
  faculty,
  displayName,
  avatar,
  statusConfig,
  showStatus,
}: FacultyDetailHeroCardProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <PersonDetailHeroCard
      id={String(faculty.id)}
      displayName={displayName}
      avatar={avatar}
      gender={faculty.gender}
      accentColor={getGenderCardAccent(faculty.gender)}
    >
      {showStatus ? (
        <StatusBadge status={resolveFacultyStatus(faculty.status)} config={statusConfig} />
      ) : null}
      {faculty.employeeId ? (
        <Badge
          as="span"
          size="sm"
          tone="primary"
          className="px-1.5 py-0.5 rounded font-bold uppercase tracking-wider"
        >
          {t("faculty.employeeIdPrefix")}: {faculty.employeeId}
        </Badge>
      ) : null}
    </PersonDetailHeroCard>
  );
}
