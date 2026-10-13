import React, { useState } from "react";
import { Users, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FORM_INPUT_COMPACT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { EnterMarksStudentRow } from "./EnterMarksStudentRow";
import type { Exam } from "@/lib/data/examinationData";
import type { ExamStudent } from "../hooks/useEnterMarksStudents";

export interface EnterMarksTableProps {
  exam: Exam;
  students: ExamStudent[];
  classNamesById: Map<string, string>;
  marks: Record<string, number | string>;
  onMarkChange: (studentId: string, value: string) => void;
}

export function EnterMarksTable({
  exam,
  students,
  classNamesById,
  marks,
  onMarkChange,
}: EnterMarksTableProps): React.JSX.Element {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState<string>("");

  const filteredStudents = (() => {
    if (!searchQuery.trim()) return students;
    const query = searchQuery.toLowerCase();
    return students.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.rollNo && s.rollNo.toLowerCase().includes(query)),
    );
  })();

  return (
    <Card accentColor="primary" className="p-0 overflow-hidden">
      <div
        className={cn(
          "px-4 py-3 border-b border-border/40 flex flex-wrap items-center justify-between gap-3 bg-muted/20",
          CARD_STRIPE_INSET,
        )}
      >
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" aria-hidden="true" />
          <h3 className="text-sm font-bold text-foreground">{t("examinations.marks")}</h3>
        </div>
        <div className="relative w-full sm:w-64">
          <Search
            className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            id="enter-marks-search"
            name="search"
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t("examinations.marks.searchPlaceholder")}
            aria-label={t("examinations.marks.searchPlaceholder")}
            className={cn(FORM_INPUT_COMPACT, "ps-8 text-xs")}
          />
        </div>
      </div>
      <div
        className={cn("divide-y divide-border/50 max-h-150 overflow-y-auto", CARD_STRIPE_INSET)}
        role="list"
      >
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t("examinations.empty.results")}
          </div>
        ) : (
          filteredStudents.map((student, index) => (
            <EnterMarksStudentRow
              key={student.id}
              student={student}
              index={index}
              exam={exam}
              classNameText={classNamesById.get(student.classId) || student.classId}
              markValue={marks[String(student.id)] ?? ""}
              onMarkChange={onMarkChange}
            />
          ))
        )}
      </div>
    </Card>
  );
}
