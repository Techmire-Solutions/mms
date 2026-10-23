import React from "react";
import { ArrowRight, Network, UserCheck, Users } from "lucide-react";
import type { Faculty } from "@mms/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";

export interface FacultyReportingHierarchyCardProps {
  faculty: Faculty;
  onFilterSubordinates?: (facultyId: string) => void;
}

/**
 * Visualizes direct supervisor and direct reporting team with quick directory filter action.
 */
export function FacultyReportingHierarchyCard({
  faculty,
  onFilterSubordinates,
}: FacultyReportingHierarchyCardProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const hasSupervisor = Boolean(faculty.reportingFacultyName || faculty.reportingFacultyId);
  const subordinateCount = Number(faculty.subordinateCount ?? 0);
  const hasSubordinates = subordinateCount > 0;

  if (!hasSupervisor && !hasSubordinates) {
    return null;
  }

  const supervisorDisplayName =
    faculty.reportingFacultyName ||
    (faculty.reportingFacultyId ? t("faculty.field.reportingFacultyId") : "");

  return (
    <SectionCard
      title={t("faculty.hierarchy.title")}
      icon={Network}
      accentColor="primary"
    >
      <div className="space-y-3 text-start">
        {hasSupervisor ? (
          <div className="p-3 rounded-lg border border-border/70 bg-card/60 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-3xs font-semibold text-muted-foreground uppercase tracking-wider">
                {t("faculty.field.reportingFacultyId")}
              </span>
              <Badge as="span" size="sm" tone="secondary" className="px-1.5 py-0.2 rounded text-3xs font-medium">
                <UserCheck className="w-3 h-3 me-1 text-primary" aria-hidden />
                {t("faculty.status.active")}
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                {supervisorDisplayName.charAt(0).toUpperCase()}
              </div>
              <span className="font-semibold text-sm text-foreground truncate">
                {supervisorDisplayName}
              </span>
            </div>
          </div>
        ) : null}

        {hasSubordinates ? (
          <div className="p-3 rounded-lg border border-border/70 bg-card/60 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-info/10 text-info flex items-center justify-center shrink-0">
                <Users className="w-3.5 h-3.5" aria-hidden />
              </div>
              <div>
                <p className="font-semibold text-xs text-foreground">
                  {t("faculty.field.subordinateCount")}
                </p>
                <p className="text-3xs text-muted-foreground">
                  {subordinateCount} {t("faculty.field.subordinates")}
                </p>
              </div>
            </div>

            {onFilterSubordinates ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onFilterSubordinates(String(faculty.id))}
                className="min-h-9 px-2.5 text-xs text-primary font-medium gap-1.5 touch-manipulation hover:bg-primary/10 border-primary/30"
              >
                <span>{t("faculty.hierarchy.viewTeam")}</span>
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" aria-hidden />
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
export default FacultyReportingHierarchyCard;
