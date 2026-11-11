import React, { useState } from "react";
import { Save, CheckCircle2, Loader2, Lock } from "lucide-react";
import { examinationsMarksTransferSchema } from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/app/StandardModuleCsvImportDialog";
import { EnterMarksTransferActions } from "./EnterMarksTransferActions";
import { type Exam, type ExamResult } from "@/lib/data/examinationData";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionFilterField } from "@/components/common/SectionFilterField";
import { cn } from "@/lib/utils";
import { useEnterMarksStudents } from "../hooks/useEnterMarksStudents";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { notify } from "@/lib/notify";
import { EnterMarksTable } from "./EnterMarksTable";

export interface EnterMarksProps {
  exams: Exam[];
  results: ExamResult[];
  onSaveResults: (examId: string, results: ExamResult[]) => void | Promise<void>;
}

/**
 * Marks already persisted for the exam, keyed by student id — the row identity and OCC token the
 * grid must echo back so a concurrent save is refused instead of silently overwriting it.
 */
function persistedMarksFor(
  exam: Exam | undefined,
  results: ExamResult[],
): Map<string, { id: string; version?: number }> {
  const persisted = new Map<string, { id: string; version?: number }>();
  if (!exam) return persisted;
  for (const result of results) {
    if (result.examId !== exam.id) continue;
    persisted.set(String(result.studentId), { id: result.id, version: result.version });
  }
  return persisted;
}

/** Marks already persisted for the exam, keyed by student id (the editable grid's seed). */
function prefilledMarksFor(
  exam: Exam | undefined,
  results: ExamResult[],
): Record<string, number | string> {
  const prefilled: Record<string, number | string> = {};
  if (!exam) return prefilled;
  for (const result of results) {
    if (result.examId === exam.id) prefilled[result.studentId] = result.marksObtained;
  }
  return prefilled;
}

export function EnterMarks({ exams, results, onSaveResults }: EnterMarksProps): React.JSX.Element {
  const { t } = useTranslation();
  const [selectedExam, setSelectedExam] = useState<string>(exams[0]?.id || "");
  const exam = exams.find((examOption) => examOption.id === selectedExam);
  const [marks, setMarks] = useState<Record<string, number | string>>(() =>
    prefilledMarksFor(exam, results),
  );
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);

  const { classNamesById, students: allStudents, sections } = useEnterMarksStudents(exam);
  const [sectionId, setSectionId] = useState<string>("");
  // Saving only the visible section never overwrites marks of other sections (bulk upsert by id).
  const students = sectionId
    ? allStudents.filter((student) => student.sectionId === sectionId)
    : allStudents;

  // Re-seed the grid when the exam or the persisted results change (render-phase reset, no effect).
  const [prevExam, setPrevExam] = useState(exam);
  const [prevResults, setPrevResults] = useState(results);
  if (prevExam !== exam || prevResults !== results) {
    setPrevExam(exam);
    setPrevResults(results);
    if (exam) {
      setMarks(prefilledMarksFor(exam, results));
      setSaved(false);
      setSectionId("");
    }
  }

  const invalidMarkCount = (() => {
    if (!exam) return 0;
    return Object.values(marks).filter((m) => {
      if (m === "" || m === undefined) return false;
      const num = Number(m);
      return isNaN(num) || num < 0 || num > exam.totalMarks;
    }).length;
  })();
  const hasInvalidMarks = invalidMarkCount > 0;

  // Unsaved edits: compare the draft against what is persisted for this exam.
  const persistedSeed = prefilledMarksFor(exam, results);
  const isDirty = Object.entries(marks).some(
    ([studentId, value]) => String(value ?? "") !== String(persistedSeed[studentId] ?? ""),
  );
  useUnsavedChangesGuard({
    isDirty,
    message: t("examinations.enterMarks.unsavedConfirm"),
  });

  // Published results are immutable: the server refuses the write and the grid is read-only.
  const isPublished = Boolean(exam?.resultsFinalizedAt);

  const handleSave = async () => {
    if (!exam || isSaving || hasInvalidMarks || isPublished) return;
    setIsSaving(true);
    try {
      const persisted = persistedMarksFor(exam, results);
      // Only rows the user actually entered: a blank cell is "not entered", never a zero mark.
      const newResults: ExamResult[] = students.flatMap((student) => {
        const raw = marks[String(student.id)];
        if (raw === "" || raw === undefined || raw === null) return [];
        const existing = persisted.get(String(student.id));
        return [
          {
            id: existing?.id ?? `er_${exam.id}_${student.id}`,
            examId: exam.id,
            studentId: String(student.id),
            marksObtained: Number(raw),
            ...(existing?.version !== undefined ? { version: existing.version } : {}),
          },
        ];
      });
      if (newResults.length === 0) {
        notify.info(t("examinations.enterMarks.nothingToSave"));
        return;
      }
      await onSaveResults(exam.id, newResults);
      setSaved(true);
    } catch {
      // The controller already surfaced the failure; swallow it here so `void handleSave()` does
      // not raise an unhandled rejection.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="enter-marks-title">
      <div>
        <span
          id="enter-marks-title"
          className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1.5 block"
        >
          {t("examinations.selectExam")}
        </span>
        <div
          className="flex flex-wrap gap-2"
          role="radiogroup"
          aria-label={t("examinations.enterMarks.selectExamAria")}
        >
          {exams.map((examOption) => {
            const isSelected = selectedExam === examOption.id;
            return (
              <Button
                key={examOption.id}
                type="button"
                role="radio"
                aria-checked={isSelected}
                onClick={() => {
                  if (isDirty && !window.confirm(t("examinations.enterMarks.unsavedConfirm"))) {
                    return;
                  }
                  setSelectedExam(examOption.id);
                  setSaved(false);
                }}
                className={cn(
                  "px-3.5 py-2 rounded-lg border text-sm font-semibold transition-all",
                  isSelected
                    ? "border-primary bg-primary/5 text-primary"
                    : "border-border bg-card hover:bg-muted text-foreground",
                )}
              >
                {examOption.name}
              </Button>
            );
          })}
        </div>
      </div>

      {exam && (
        <>
          <div
            className="rounded-xl border border-border bg-muted/30 px-4 py-3 flex flex-wrap gap-4 text-sm"
            role="status"
            aria-label={t("examinations.enterMarks.examDetailsAria")}
          >
            <span>
              <strong className="text-foreground">{exam.subject}</strong>
            </span>
            <span className="text-muted-foreground">
              {t("examinations.enterMarks.totalLabel")}:{" "}
              <strong className="text-foreground">{exam.totalMarks}</strong>
            </span>
            <span className="text-muted-foreground">
              {t("examinations.enterMarks.passingLabel")}:{" "}
              <strong className="text-foreground">{exam.passingMarks}</strong>
            </span>
            <span className="text-muted-foreground">
              {t("examinations.stats.students")}:{" "}
              <strong className="text-foreground">{students.length}</strong>
            </span>
          </div>

          {isPublished && (
            <div
              role="status"
              className="rounded-xl border border-warning/40 bg-warning/10 px-4 py-3 text-sm"
            >
              <p className="m-0 flex items-center gap-2 font-semibold text-foreground">
                <Lock className="h-4 w-4" aria-hidden="true" />
                {t("examinations.enterMarks.lockedTitle")}
              </p>
              <p className="m-0 mt-1 text-muted-foreground">
                {t("examinations.enterMarks.lockedHelp")}
              </p>
            </div>
          )}

          <SectionFilterField
            id="marks-section"
            sections={sections}
            value={sectionId}
            onChange={setSectionId}
          />

          <EnterMarksTable
            exam={exam}
            students={students}
            classNamesById={classNamesById}
            marks={marks}
            readOnly={isPublished}
            onMarkChange={(studentId, value) => {
              setMarks((previousMarks) => ({ ...previousMarks, [studentId]: value }));
              setSaved(false);
            }}
          />

          <div className="flex flex-wrap items-center justify-end gap-3">
            {exam && (
              <EnterMarksTransferActions
                examId={exam.id}
                importDisabled={isPublished}
                onImport={() => setImportOpen(true)}
              />
            )}
            {hasInvalidMarks && (
              <p role="alert" className="m-0 text-xs font-semibold text-destructive">
                {t("examinations.enterMarks.invalidSummary", { count: invalidMarkCount })}
              </p>
            )}
            {saved ? (
              <div
                className="flex items-center gap-2 text-success text-sm font-semibold"
                role="status"
              >
                <CheckCircle2 className="w-4 h-4" aria-hidden="true" />{" "}
                {t("examinations.enterMarks.saved")}
              </div>
            ) : (
              <Button
                type="button"
                disabled={isSaving || hasInvalidMarks || isPublished}
                onClick={() => {
                  void handleSave();
                }}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90"
              >
                {isSaving ? (
                  <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Save className="w-4 h-4" aria-hidden="true" />
                )}
                {t("examinations.enterMarks.save")}
              </Button>
            )}
          </div>
        </>
      )}

      {exam && (
        <StandardModuleCsvImportDialog
          open={importOpen}
          onClose={() => setImportOpen(false)}
          canWrite={!isPublished}
          apiPath={`/api/examinations/exams/${exam.id}/results/import`}
          schema={examinationsMarksTransferSchema}
          title={t("common.import")}
        />
      )}
    </section>
  );
}
