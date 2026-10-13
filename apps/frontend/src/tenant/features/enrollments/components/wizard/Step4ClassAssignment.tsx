import React, { useState } from "react";
import { Layers, Users, CheckCircle2 } from "lucide-react";
import { type Session, type Class } from "@/lib/data/sessionsData";
import { type Student } from "@/lib/data/studentsData";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/app/ProgressBar";
import { EmptyState } from "@/components/app/EmptyState";
import { WarningCallout } from "@/components/app/WarningCallout";
import { useTranslation } from "@/hooks/useTranslation";

export interface Step4ClassAssignmentProps {
  session: Session | null | undefined;
  student: Student | null | undefined;
  suggestedClass: Class | null | undefined;
  value: Class | null | undefined;
  onChange: (sessionClass: Class) => void;
}

/**
 * Step 4 component for selecting a class within a session.
 *
 * @param props - Component props.
 * @param props.session - Selected session.
 * @param props.student - Current student.
 * @param props.suggestedClass - Auto-suggested class match.
 * @param props.value - Selected class.
 * @param props.onChange - Callback on class selection change.
 * @returns The Step4ClassAssignment component.
 */
export function Step4ClassAssignment({
  session,
  student: _student,
  suggestedClass,
  value,
  onChange,
}: Step4ClassAssignmentProps): React.JSX.Element {
  const { t } = useTranslation();
  const [override, setOverride] = useState<boolean>(false);
  const classes = session?.classes || [];

  const handleSelect = (sessionClass: Class) => {
    const isOverride = suggestedClass && sessionClass.id !== suggestedClass.id;
    setOverride(!!isOverride);
    onChange(sessionClass);
  };

  return (
    <section className="space-y-4" aria-labelledby="step4-title">
      <div>
        <h3 id="step4-title" className="text-base font-bold text-foreground">
          {t("enrollments.wizard.step4Title")}
        </h3>
        <p className="text-sm text-muted-foreground mt-0.5">
          {t("enrollments.wizard.step4Desc", { session: session?.name || "—" })}
        </p>
      </div>

      {/* Auto-suggestion banner */}
      {suggestedClass && (
        <div
          className="flex items-start gap-3 px-4 py-3 rounded-xl bg-primary/5 border border-primary/20"
          role="status"
        >
          <CheckCircle2 className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-foreground">
              {t("enrollments.wizard.step4AutoSuggested", { name: suggestedClass.name })}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("enrollments.wizard.step4AutoSuggestedHint")}
            </p>
          </div>
        </div>
      )}

      {!suggestedClass && (
        <WarningCallout
          role="status"
          density="banner"
          className="items-start"
          description={t("enrollments.wizard.step4NoAutoMatch")}
        />
      )}

      {/* Override warning */}
      {override && (
        <WarningCallout
          role="alert"
          density="banner"
          className="items-start font-semibold"
          description={t("enrollments.wizard.step4OverrideWarning")}
        />
      )}

      {/* Class list */}
      <div
        className="space-y-2"
        role="radiogroup"
        aria-label={t("enrollments.wizard.step4ClassesAria")}
      >
        {classes.length === 0 && (
          <EmptyState title={t("enrollments.wizard.step4Empty")} icon={Layers} compact />
        )}
        {classes.map((sessionClass) => {
          const selected = value?.id === sessionClass.id;
          const isSuggested = suggestedClass?.id === sessionClass.id;
          const legacyClass = sessionClass as Class & {
            capacity?: number;
            ageMin?: number;
            ageMax?: number;
          };
          const maxCapacity = sessionClass.maxStudents || legacyClass.capacity || 30;
          const enrolled = sessionClass.enrolled ?? 0;
          const spotsLeft = maxCapacity - enrolled;
          const full = spotsLeft <= 0;
          const minAge = sessionClass.minAge || legacyClass.ageMin || 5;
          const maxAge = sessionClass.maxAge || legacyClass.ageMax || 18;

          return (
            <Button
              key={sessionClass.id}
              role="radio"
              aria-checked={selected}
              disabled={full}
              onClick={() => !full && handleSelect(sessionClass)}
              variant="outline"
              className={`w-full text-start p-4 rounded-xl border-2 transition-all h-auto disabled:opacity-50 disabled:cursor-not-allowed justify-start hover:bg-transparent ${
                selected
                  ? "border-primary bg-primary/5 hover:bg-primary/5 text-foreground hover:text-foreground"
                  : "border-border bg-card hover:border-primary/40 hover:bg-muted/30 text-foreground hover:text-foreground"
              }`}
            >
              <div className="flex items-center justify-between gap-3 flex-wrap w-full">
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Layers className="w-4 h-4 text-primary" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="text-sm font-bold text-foreground">{sessionClass.name}</p>
                      {isSuggested && (
                        <Badge pill tone="primary" className="px-1.5 font-bold">
                          {t("enrollments.wizard.step4Recommended")}
                        </Badge>
                      )}
                      {full && (
                        <Badge
                          pill
                          tone="destructive"
                          className="px-1.5 font-bold bg-destructive/15"
                        >
                          {t("enrollment.session.full")}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5 flex-wrap">
                      <span>
                        {t("enrollments.wizard.step4AgeRange", { min: minAge, max: maxAge })}
                      </span>
                      <span className="capitalize">{sessionClass.gender}</span>
                      <span>{sessionClass.facultyName}</span>
                      {sessionClass.room && <span>{sessionClass.room}</span>}
                    </div>
                  </div>
                </div>
                {/*
                  Not `aria-hidden`: the class's remaining capacity is exactly the
                  information that decides whether this class is a sensible choice,
                  and hiding the whole block made it unavailable to assistive tech
                  (this element is inside the option `<Button>`, so its content is
                  the option's name). The bar stays `aria-hidden` — the figures next
                  to it already carry the value.
                */}
                <div className="text-end flex-shrink-0">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Users className="w-3.5 h-3.5" />
                    <span>
                      {enrolled}/{maxCapacity}
                    </span>
                  </div>
                  <ProgressBar
                    className="mt-1"
                    value={(enrolled / maxCapacity) * 100}
                    fillClassName={
                      spotsLeft <= 3
                        ? "bg-destructive"
                        : spotsLeft <= 7
                          ? "bg-warning"
                          : "bg-success"
                    }
                    trackClassName="w-20 flex-none"
                    aria-hidden="true"
                  />
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("enrollments.wizard.step4SpotsLeft", { count: spotsLeft })}
                  </p>
                </div>
              </div>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
