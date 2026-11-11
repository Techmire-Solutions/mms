import React from "react";
import { BookOpen, Trophy, CheckCircle2, Clock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/app/FormSelect";
import { DatePicker } from "@/components/app/DatePicker";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/FormPrimitives";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { parseIntegerInput } from "../lib/examFormValidation";
import { EXAM_STATUSES, SESSIONS_MODULE_MANIFEST, allowedNextStatuses } from "@mms/shared";
import { AcademicCatalogSelect } from "@/components/common/catalog/AcademicCatalogSelect";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import type { useExaminationForm } from "../hooks/useExaminationForm";
import type { Exam } from "@/lib/data/examinationData";

export type ExaminationFormFieldsProps = Pick<
  ReturnType<typeof useExaminationForm>,
  "t" | "errors" | "examDraft" | "exam" | "classes" | "updateDraft" | "getFieldError"
>;

export function ExaminationFormFields({
  t,
  errors,
  examDraft,
  exam,
  classes,
  updateDraft,
  getFieldError: _getFieldError,
}: ExaminationFormFieldsProps): React.JSX.Element {
  /**
   * Only legal moves are offered. A new exam may start in any state; an existing one may keep its
   * state or move forward (the backend rejects anything else with `illegal_exam_transition`).
   */
  const statusOptions = (() => {
    const current = exam?.status;
    const allowed = current ? [current, ...allowedNextStatuses(current)] : [...EXAM_STATUSES];
    return [...new Set(allowed)].map((value) => ({
      value,
      label: t(`examinations.status.${value}`),
    }));
  })();
  // Subjects are a Sessions catalog; quick-create needs Sessions setup permission.
  const { canEditSetup: canCreateSubject } = useModulePermissions(SESSIONS_MODULE_MANIFEST);
  return (
    <div className="space-y-5 text-start">
      <SectionCard
        accentColor="primary"
        icon={BookOpen}
        title={t("examinations.form.section.parameters")}
        className="shadow-sm"
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="sm:col-span-2">
            <Field
              id="exam-name"
              label={t("examinations.form.fields.name")}
              required
              error={errors.name}
            >
              <div className="relative flex items-center group/input">
                <BookOpen className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
                <Input
                  id="exam-name"
                  name="name"
                  className={`${FORM_INPUT} ps-10`}
                  value={examDraft.name || ""}
                  onChange={(event) => updateDraft({ name: event.target.value })}
                  placeholder={t("examinations.form.placeholders.name")}
                  required
                />
              </div>
            </Field>
          </div>

          <Field id="exam-subject" label={t("examinations.form.fields.subject")}>
            <AcademicCatalogSelect
              kind="subjects"
              source="examinations"
              id="exam-subject"
              name="subjectId"
              value={examDraft.subjectId ?? ""}
              onChange={(subjectId, subject) =>
                updateDraft({ subjectId, subject: subject?.name ?? "" })
              }
              canCreate={canCreateSubject}
              allowNone
            />
          </Field>

          <Field id="exam-status" label={t("examinations.form.fields.status")}>
            <FormSelect
              id="exam-status"
              name="status"
              value={examDraft.status || "upcoming"}
              onChange={(val) => updateDraft({ status: val as Exam["status"] })}
              options={statusOptions}
            />
          </Field>

          <Field id="exam-total" label={t("examinations.form.fields.totalMarks")}>
            <div className="relative flex items-center group/input">
              <Trophy className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
              <Input
                id="exam-total"
                name="totalMarks"
                type="text"
                inputMode="numeric"
                dir="ltr"
                className={`${FORM_INPUT} ps-10 text-end`}
                value={examDraft.totalMarks ?? ""}
                onChange={(event) =>
                  updateDraft({ totalMarks: parseIntegerInput(event.target.value) })
                }
                min={1}
                required
              />
            </div>
          </Field>

          <Field
            id="exam-passing"
            label={t("examinations.form.fields.passingMarks")}
            error={errors.passingMarks}
          >
            <div className="relative flex items-center group/input">
              <CheckCircle2 className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
              <Input
                id="exam-passing"
                name="passingMarks"
                type="text"
                inputMode="numeric"
                dir="ltr"
                className={`${FORM_INPUT} ps-10 text-end`}
                value={examDraft.passingMarks ?? ""}
                onChange={(event) =>
                  updateDraft({ passingMarks: parseIntegerInput(event.target.value) })
                }
                min={1}
                max={examDraft.totalMarks ?? 100}
                required
              />
            </div>
          </Field>

          <div className="sm:col-span-2">
            <Field
              id="exam-duration"
              label={t("examinations.form.fields.durationMinutes")}
              error={errors.duration}
            >
              <div className="relative flex items-center group/input">
                <Clock className="absolute start-3.5 w-4 h-4 text-muted-foreground/60 group-focus-within/input:text-primary transition-colors pointer-events-none" />
                <Input
                  id="exam-duration"
                  name="duration"
                  type="text"
                  inputMode="numeric"
                  dir="ltr"
                  className={`${FORM_INPUT} ps-10 text-end`}
                  value={examDraft.duration ?? 60}
                  onChange={(event) =>
                    updateDraft({ duration: parseIntegerInput(event.target.value) })
                  }
                  min={5}
                  required
                />
              </div>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              id="exam-date"
              label={t("examinations.form.fields.examDate")}
              required
              error={errors.date}
            >
              <DatePicker
                id="exam-date"
                name="date"
                value={examDraft.date || ""}
                onChange={(val) => updateDraft({ date: val })}
                required
              />
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field
              id="exam-classes"
              label={t("examinations.form.fields.assignClasses")}
              required
              error={errors.classIds}
            >
              <div
                className="flex flex-wrap gap-2"
                role="group"
                aria-label={t("examinations.form.aria.assignClassesList")}
              >
                {(() => {
                  const classIdSet = new Set(examDraft.classIds ?? []);
                  return classes.map((sessionClass) => {
                    const active = classIdSet.has(sessionClass.id);
                    return (
                      <Button
                        key={sessionClass.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          const next = new Set(examDraft.classIds ?? []);
                          if (next.has(sessionClass.id)) {
                            next.delete(sessionClass.id);
                          } else {
                            next.add(sessionClass.id);
                          }
                          updateDraft({ classIds: [...next] });
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-sm font-semibold transition-all ${
                          active
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border bg-muted hover:bg-muted/80 text-foreground"
                        }`}
                      >
                        {sessionClass.name}
                      </Button>
                    );
                  });
                })()}
              </div>
            </Field>
          </div>

          <div className="sm:col-span-2">
            <Field id="exam-desc" label={t("examinations.form.fields.description")}>
              <Textarea
                id="exam-desc"
                name="description"
                value={examDraft.description || ""}
                onChange={(event) => updateDraft({ description: event.target.value })}
                placeholder={t("examinations.form.placeholders.description")}
              />
            </Field>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
