import React, { useState, useEffect } from "react";
import { Save, CheckCircle2, Loader2 } from "lucide-react";
import { type Exam, type ExamResult } from "@/lib/data/examinationData";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { SectionFilterField } from "@/components/common/SectionFilterField";
import { cn } from "@/lib/utils";
import { useEnterMarksStudents } from "../hooks/useEnterMarksStudents";
import { EnterMarksTable } from "./EnterMarksTable";

export interface EnterMarksProps {
  exams: Exam[];
  results: ExamResult[];
  onSaveResults: (examId: string, results: ExamResult[]) => void | Promise<void>;
}

export function EnterMarks({ exams, results, onSaveResults }: EnterMarksProps): React.JSX.Element {
  const { t } = useTranslation();
  const [selectedExam, setSelectedExam] = useState<string>(exams[0]?.id || "");
  const [marks, setMarks] = useState<Record<string, number | string>>({});
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saved, setSaved] = useState<boolean>(false);

  const exam = exams.find((examOption) => examOption.id === selectedExam);
  const { classNamesById, students: allStudents, sections } = useEnterMarksStudents(exam);
  const [sectionId, setSectionId] = useState<string>("");
  // Saving only the visible section never overwrites marks of other sections (bulk upsert by id).
  const students = sectionId
    ? allStudents.filter((student) => student.sectionId === sectionId)
    : allStudents;

  useEffect(() => {
    if (!exam) return;
    const prefilledMarks: Record<string, number | string> = {};
    results
      .filter((examResult) => examResult.examId === exam.id)
      .forEach((examResult) => {
        prefilledMarks[examResult.studentId] = examResult.marksObtained;
      });
    setMarks(prefilledMarks);
    setSaved(false);
    setSectionId("");
  }, [selectedExam, exam, results]);

  const hasInvalidMarks = (() => {
    if (!exam) return false;
    return Object.values(marks).some((m) => {
      if (m === "" || m === undefined) return false;
      const num = Number(m);
      return isNaN(num) || num < 0 || num > exam.totalMarks;
    });
  })();

  const handleSave = async () => {
    if (!exam || isSaving || hasInvalidMarks) return;
    setIsSaving(true);
    try {
      const newResults: ExamResult[] = students.map((student) => ({
        id: `er_${exam.id}_${student.id}`,
        examId: exam.id,
        studentId: String(student.id),
        marksObtained: Number(marks[String(student.id)] || 0),
      }));
      await onSaveResults(exam.id, newResults);
      setSaved(true);
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
            onMarkChange={(studentId, value) => {
              setMarks((previousMarks) => ({ ...previousMarks, [studentId]: value }));
              setSaved(false);
            }}
          />

          <div className="flex justify-end">
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
                disabled={isSaving || hasInvalidMarks}
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
    </section>
  );
}
