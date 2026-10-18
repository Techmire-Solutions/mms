import React from "react";
import { BookOpen, Calendar, Users, DollarSign } from "lucide-react";
import { type Session } from '@/lib/data/sessionsData';
import { SEMANTIC_BADGE, WIZARD_SELECTION_DOT } from "@/lib/semanticTone";
import { StatusBadge, type StatusBadgeConfigItem } from '@/components/ui/StatusBadge';
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/EmptyState";

/**
 * Format a date string to a localized PK date.
 *
 * @param date - Date string to format.
 * @returns Formatted date.
 */
import { formatDate } from "@mms/shared";
import { useFinanceCurrency } from "@/hooks/useCurrency";


import { normalizeSessionStatus, SESSION_ENROLLABLE_STATES } from "@mms/shared";
export interface Step2SelectSessionProps {
  value: Session | null | undefined;
  onChange: (session: Session) => void;
  sessions?: Session[];
}

/**
 * Step 2 component for selecting a session.
 *
 * @param props - Component props.
 * @param props.value - Selected session object.
 * @param props.onChange - Callback when session selection changes.
 * @param props.sessions - Dynamic list of active/inactive sessions.
 * @returns The Step2SelectSession component.
 */
export function Step2SelectSession({ value, onChange, sessions = [] }: Step2SelectSessionProps): React.JSX.Element {
  const { formatCurrency } = useFinanceCurrency();
  const { t } = useTranslation();
  const sessionStatusConfig = (() => ({
      full: { label: t("enrollment.session.full"), cls: SEMANTIC_BADGE.destructiveStrong },
      almost_full: { label: t("enrollment.session.almostFull"), cls: SEMANTIC_BADGE.warningStrong },
    }))() as Record<string, StatusBadgeConfigItem>;
  const activeSessions = sessions.filter((session) => SESSION_ENROLLABLE_STATES.includes(normalizeSessionStatus(session.status)));

  return (
    <section className="space-y-4" aria-labelledby="step2-title">
      <div>
        <h3 id="step2-title" className="text-base font-bold text-foreground">{t("enrollments.wizard.step2Title")}</h3>
        <p className="text-sm text-muted-foreground mt-0.5">{t("enrollments.wizard.step2Desc")}</p>
      </div>

      <div className="space-y-3" role="radiogroup" aria-label={t("enrollments.wizard.step2SessionsAria")}>
        {activeSessions.length === 0 && (
          <EmptyState title={t("enrollments.wizard.step2Empty")} compact icon={null} />
        )}
        {activeSessions.map((session) => {
          const selected = value?.id === session.id;
          const totalSpots = (session.classes && session.classes.length > 0)
            ? session.classes.reduce((total, sessionClass) => {
                const cap = sessionClass.maxStudents || (sessionClass as { capacity?: number }).capacity || 30;
                return total + cap;
              }, 0)
            : 30;
          const totalEnrolled = (session.classes || []).reduce((total, sessionClass) => total + (sessionClass.enrolled ?? 0), 0);

          const spotsLeft = Math.max(0, totalSpots - totalEnrolled);
          const isFull = spotsLeft <= 0;

          return (
            <Button
              key={session.id}
              role="radio"
              aria-checked={selected}
              disabled={isFull}
              onClick={() => !isFull && onChange(session)}
              variant="outline"
              className={`w-full text-start p-4 rounded-xl border-2 transition-all h-auto disabled:opacity-50 disabled:cursor-not-allowed justify-start hover:bg-transparent ${
                selected ? "border-primary bg-primary/5 hover:bg-primary/5 text-foreground hover:text-foreground" : "border-border bg-card hover:border-primary/40 hover:bg-muted/30 text-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-start gap-3 w-full">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <BookOpen className="w-5 h-5 text-primary" aria-hidden="true" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold text-foreground">{session.name}</p>
                    <Badge pill tone="primary" className="px-1.5 font-bold">{session.type}</Badge>
                    {isFull && <StatusBadge status="full" config={sessionStatusConfig} size="sm" />}
                    {!isFull && spotsLeft <= 5 && <StatusBadge status="almost_full" config={sessionStatusConfig} size="sm" />}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    <div className="flex min-w-0 items-center gap-1 text-xs text-muted-foreground sm:col-span-1">
                      <Calendar className="w-3 h-3 shrink-0" aria-hidden="true" />
                      <span className="min-w-0 truncate">{formatDate(session.startDate)} – {formatDate(session.endDate)}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Users className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{t("enrollments.wizard.step2SpotsLeft", { count: spotsLeft })}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-bold text-foreground">
                      <DollarSign className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
                      {formatCurrency(session.baseFee)}
                    </div>
                  </div>
                  {session.classes && session.classes.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {session.classes.map((sessionClass) => (
                        <Badge key={sessionClass.id} pill tone="muted" className="px-2 font-medium">
                          {t("enrollments.wizard.step2ClassSpots", {
                            name: sessionClass.name,
                            count: (sessionClass.maxStudents ?? (sessionClass as { capacity?: number }).capacity ?? 30) - (sessionClass.enrolled ?? 0),
                          })}

                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {selected && (
                  <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                    <div className={`h-2 w-2 rounded-full ${WIZARD_SELECTION_DOT}`} />
                  </div>
                )}
              </div>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
