import React from "react";
import { BookOpen, School, Users, DoorOpen } from "lucide-react";
import { sessionTypeI18nKey, type AppTranslationKey } from "@mms/shared";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailSectionTitle } from "@/components/app/DetailSectionTitle";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import type { FacultyAssignedClassItem } from "@/lib/faculty/facultyAssignment";

function sessionStatusLabel(status: string, t: (key: AppTranslationKey) => string): string {
  const key = `sessions.status.${status}` as AppTranslationKey;
  const translated = t(key);
  return translated === key ? status : translated;
}

export interface FacultyDetailSessionsSectionProps {
  assignedClasses: FacultyAssignedClassItem[];
  loading?: boolean;
  error?: boolean;
}

export function FacultyDetailSessionsSection({
  assignedClasses,
  loading,
  error,
}: FacultyDetailSessionsSectionProps): React.JSX.Element {
  const { t } = useTranslation();
  const assignedClassesTitle = t("faculty.detail.assignedClasses");

  if (loading) {
    return (
      <DetailSectionCard title={assignedClassesTitle} className="p-3.5 space-y-2.5">
        <Skeleton className="h-12 w-full rounded-xl" />
        <Skeleton className="h-12 w-full rounded-xl" />
      </DetailSectionCard>
    );
  }

  if (error) {
    return (
      <DetailSectionCard title={assignedClassesTitle} className="p-3.5">
        <ErrorState
          compact
          title={t("faculty.loadFailed")}
          description={t("faculty.loadFailedHint")}
        />
      </DetailSectionCard>
    );
  }

  if (assignedClasses.length === 0) {
    return (
      <DetailSectionCard title={assignedClassesTitle} className="p-3.5">
        <EmptyState
          compact
          icon={School}
          title={t("faculty.detail.noAssignedClasses")}
          description={t("faculty.empty.subtitle")}
        />
      </DetailSectionCard>
    );
  }

  // Multi-card list: title + per-class cards (DetailSectionCard is single-card).
  return (
    <div className="space-y-3">
      <DetailSectionTitle count={assignedClasses.length}>{assignedClassesTitle}</DetailSectionTitle>

      <div className="space-y-2.5">
        {assignedClasses.map((item) => {
          const typeKey = item.sessionType ? sessionTypeI18nKey(item.sessionType) : null;
          const typeLabel = typeKey ? t(typeKey) : item.sessionType || "";

          return (
            <Card
              key={`${item.sessionId}-${item.classId}`}
              accentColor="primary"
              className="p-3.5 space-y-2.5 bg-card hover:bg-card/90 transition-colors border-border/70"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <BookOpen className="w-4 h-4 text-primary shrink-0" aria-hidden />
                  <h5 className="text-sm font-bold text-foreground truncate">{item.className}</h5>
                </div>
                {typeLabel ? (
                  <Badge
                    as="span"
                    size="sm"
                    tone="primary"
                    className="px-2 py-0.5 rounded-full text-2xs font-bold uppercase tracking-wider shrink-0"
                  >
                    {typeLabel}
                  </Badge>
                ) : null}
              </div>

              <div className="text-xs text-muted-foreground bg-muted/40 p-2.5 rounded-xl space-y-1.5 border border-border/40">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-foreground/90 truncate">
                    {item.sessionName}
                  </span>
                  {item.sessionStatus ? (
                    <span className="text-2xs uppercase font-bold text-muted-foreground tracking-wider">
                      {sessionStatusLabel(item.sessionStatus, t)}
                    </span>
                  ) : null}
                </div>

                <div className="flex flex-wrap items-center gap-3 pt-1 text-3xs text-muted-foreground border-t border-border/40">
                  {item.room ? (
                    <div className="flex items-center gap-1">
                      <DoorOpen className="w-3.5 h-3.5 text-primary/70" aria-hidden />
                      <span>{t("faculty.detail.room", { room: item.room })}</span>
                    </div>
                  ) : null}

                  {item.enrolled != null ? (
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-primary/70" aria-hidden />
                      <span>{t("faculty.detail.enrolledCount", { count: item.enrolled })}</span>
                      {item.capacity ? (
                        <span className="text-muted-foreground">
                          ({t("faculty.detail.capacity", { capacity: item.capacity })})
                        </span>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
