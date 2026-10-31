import React from "react";
import { Award, Briefcase, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { DetailSectionTitle } from "@/components/app/DetailSectionTitle";
import { useTranslation } from "@/hooks/useTranslation";
import { useFacultyAssignments } from "../hooks/useFacultyAssignments";

export interface FacultyDetailAssignmentsSectionProps {
  facultyId: string;
  primaryDesignation?: string | null;
  primaryDepartment?: string | null;
}

/**
 * Displays full multi-role appointment history for a faculty member.
 * Shows active, secondary, and past appointments with dates and primary badges.
 */
export function FacultyDetailAssignmentsSection({
  facultyId,
  primaryDesignation,
  primaryDepartment,
}: FacultyDetailAssignmentsSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { data: assignments = [], isLoading } = useFacultyAssignments(facultyId);

  const title = t("faculty.tabs.designations");

  if (isLoading) {
    return (
      <div className="space-y-2.5">
        <DetailSectionTitle>{title}</DetailSectionTitle>
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  // Display assignments from DB, or fallback to the primary designation/department if none returned
  const displayItems =
    assignments.length > 0
      ? assignments
      : primaryDesignation || primaryDepartment
        ? [
            {
              id: "primary-fallback",
              facultyId,
              departmentId: "",
              departmentName: primaryDepartment ?? undefined,
              designationId: "",
              designationName: primaryDesignation ?? undefined,
              isPrimary: true,
              status: "active" as const,
              startDate: "",
              endDate: null,
            },
          ]
        : [];

  if (displayItems.length === 0) return null;

  return (
    <div className="space-y-3">
      <DetailSectionTitle count={displayItems.length}>{title}</DetailSectionTitle>
      <div className="space-y-2.5">
        {displayItems.map((item) => {
          const isPrimary = item.isPrimary;
          const isActive = item.status === "active";

          return (
            <Card
              key={item.id}
              className="p-3.5 space-y-2 bg-card hover:bg-card/90 transition-colors border-border/70"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <Award className="w-4 h-4 text-primary shrink-0" aria-hidden />
                  <h5 className="text-sm font-bold text-foreground truncate">
                    {item.designationName || t("faculty.field.designation")}
                  </h5>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {isPrimary ? (
                    <Badge
                      as="span"
                      size="sm"
                      tone="primary"
                      className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider"
                    >
                      {t("faculty.assignments.primaryBadge")}
                    </Badge>
                  ) : null}
                  <Badge
                    as="span"
                    size="sm"
                    tone={isActive ? "success" : "muted"}
                    className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider"
                  >
                    {isActive ? t("faculty.status.active") : t("faculty.status.inactive")}
                  </Badge>
                </div>
              </div>

              {item.departmentName ? (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Briefcase className="w-3.5 h-3.5 text-muted-foreground shrink-0" aria-hidden />
                  <span className="truncate">{item.departmentName}</span>
                </div>
              ) : null}

              {item.startDate ? (
                <div className="flex items-center gap-1.5 text-2xs text-muted-foreground pt-1 border-t border-border/40">
                  <Calendar className="w-3 h-3 text-muted-foreground/60 shrink-0" aria-hidden />
                  <span>
                    {item.startDate} —{" "}
                    {item.endDate ? item.endDate : t("faculty.designations.present")}
                  </span>
                </div>
              ) : null}

              {item.notes ? (
                <p className="text-xs text-muted-foreground italic line-clamp-2 pt-1">
                  {item.notes}
                </p>
              ) : null}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
