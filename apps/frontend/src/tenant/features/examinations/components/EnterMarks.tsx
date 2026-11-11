import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Save, CheckCircle2, Loader2, Lock } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { examinationsMarksTransferSchema } from "@mms/shared";
import { StandardModuleCsvImportDialog } from "@/components/app/StandardModuleCsvImportDialog";
import { EnterMarksTransferActions } from "./EnterMarksTransferActions";
import { type Exam, type ExamResult } from "@/lib/data/examinationData";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionFilterField } from "@/components/common/SectionFilterField";
import { useEnterMarksStudents } from "../hooks/useEnterMarksStudents";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { notify } from "@/lib/notify";
import { EnterMarksTable } from "./EnterMarksTable";
import { EnterMarksExamSelector } from "./EnterMarksExamSelector";
import { invalidateExaminationsQueries } from "../hooks/invalidateExaminationsQueries";
import {
  buildMarksSavePayload,
  persistedMarksFor,
  prefilledMarksFor,
} from "../lib/enterMarksDraft";

export interface EnterMarksProps {
  exams: Exam[];
  results: ExamResult[];
  onSaveResults: (examId: string, results: ExamResult[]) => void | Promise<void>;
  /** Reports draft dirtiness to the modal shell so closing it can confirm a discard. */
  onDirtyChange?: (isDirty: boolean) => void;
}

export function EnterMarks({
  exams,
  results,
  onSaveResults,
  onDirtyChange,
}: EnterMarksProps): React.JSX.Element {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedExam, setSelectedExam] = useState<string>(exams[0]?.id || "");
  const exam = exams.find((examOption) => examOption.id === selectedExam);
  const [marks, setMarks] = useState<Record<string, number | string>>(() =>
    prefilledMarksFor(exam, results),
  );
  // Snapshot of the persisted rows (id + OCC token + mark) captured when editing began. The grid
  // compares drafts against this, and saves use these tokens so an external change still 409s
  // instead of being silently overwritten by a refetch.
  const [seed, setSeed] = useState(() => persistedMarksFor(exam, results));
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [importOpen, setImportOpen] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const { classNamesById, students: allStudents, sections } = useEnterMarksStudents(exam);
  const [sectionId, setSectionId] = useState<string>("");
  // Saving only the visible section never overwrites marks of other sections (bulk upsert by id).
  const students = sectionId
    ? allStudents.filter((student) => student.sectionId === sectionId)
    : allStudents;

  const isDirty = useMemo(
    () =>
      Object.entries(marks).some(
        ([studentId, value]) =>
          String(value ?? "") !== String(seed.get(studentId)?.marksObtained ?? ""),
      ),
    [marks, seed],
  );

  // Re-seed only when the exam changes, or when the persisted rows change while there is nothing
  // to lose. A background refetch must never wipe an in-progress draft.
  const [prevExam, setPrevExam] = useState(exam);
  const [prevResults, setPrevResults] = useState(results);
  if (prevExam !== exam) {
    setPrevExam(exam);
    setPrevResults(results);
    if (exam) {
      setMarks(prefilledMarksFor(exam, results));
      setSeed(persistedMarksFor(exam, results));
      setSaved(false);
      setSaveError(null);
      setSectionId("");
    }
  } else if (prevResults !== results) {
    setPrevResults(results);
    if (!isDirty) {
      setMarks(prefilledMarksFor(exam, results));
      setSeed(persistedMarksFor(exam, results));
    }
  }

  const invalidMarkCount = useMemo(() => {
    if (!exam) return 0;
    return Object.values(marks).filter((m) => {
      if (m === "" || m === undefined) return false;
      const num = Number(m);
      return isNaN(num) || num < 0 || num > exam.totalMarks;
    }).length;
  }, [marks, exam]);
  const hasInvalidMarks = invalidMarkCount > 0;

  useEffect(() => {
    onDirtyChange?.(isDirty);
  }, [isDirty, onDirtyChange]);

  useUnsavedChangesGuard({
    isDirty,
    message: t("examinations.enterMarks.unsavedConfirm"),
  });

  // Published results are immutable: the server refuses the write and the grid is read-only.
  const isPublished = Boolean(exam?.resultsFinalizedAt);

  const handleMarkChange = useCallback((studentId: string, value: string) => {
    setMarks((previousMarks) => ({ ...previousMarks, [studentId]: value }));
    setSaved(false);
    setSaveError(null);
  }, []);

  const handleSave = async () => {
    if (!exam || isSaving || hasInvalidMarks || isPublished || !isDirty) return;
    setIsSaving(true);
    try {
      setSaveError(null);
      const newResults = buildMarksSavePayload(exam, students, marks, seed);

      if (newResults.length === 0) {
        notify.info(t("examinations.enterMarks.nothingToSave"));
        return;
      }
      await onSaveResults(exam.id, newResults);
      setSeed((previous) => {
        const next = new Map(previous);
        for (const result of newResults) {
          next.set(result.studentId, {
            id: result.id,
            version: result.version,
            marksObtained: result.marksObtained,
          });
        }
        return next;
      });
      setSaved(true);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t("examinations.saveFailed"));
      // The controller already surfaced the failure; swallow it here so `void handleSave()` does
      // not raise an unhandled rejection.
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-5" aria-labelledby="enter-marks-title">
      <EnterMarksExamSelector
        exams={exams}
        selectedExam={selectedExam}
        isDirty={isDirty}
        onSelect={(examId) => {
          setSelectedExam(examId);
          setSaved(false);
        }}
      />

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
            onMarkChange={handleMarkChange}
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
            {saveError && (
              <p
                role="alert"
                className="m-0 flex items-center gap-2 text-xs font-semibold text-destructive"
              >
                {t("examinations.enterMarks.saveFailed", { message: saveError })}
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    void handleSave();
                  }}
                >
                  {t("common.retry")}
                </Button>
              </p>
            )}
            {saved && !isDirty ? (
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
                disabled={isSaving || hasInvalidMarks || isPublished || !isDirty}
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
          onSuccess={() => invalidateExaminationsQueries(queryClient)}
        />
      )}
    </section>
  );
}
