import React, { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
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
  /** Published results: renders the grid read-only. */
  readOnly?: boolean;
}

export function EnterMarksTable({
  exam,
  students,
  classNamesById,
  marks,
  onMarkChange,
  readOnly = false,
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

  const listRef = useRef<HTMLDivElement | null>(null);

  /**
   * Enter / ArrowDown / ArrowUp move between mark inputs in visual order (the same order the
   * virtualizer renders), so a marker can walk a roster without leaving the keyboard.
   */
  const handleGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>): void => {
    if (event.key !== "Enter" && event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const target = event.target as HTMLElement;
    if (target.tagName !== "INPUT") return;
    const inputs = Array.from(
      event.currentTarget.querySelectorAll<HTMLInputElement>("[data-marks-input]"),
    );
    const index = inputs.indexOf(target as HTMLInputElement);
    if (index === -1) return;
    const next = event.key === "ArrowUp" ? inputs[index - 1] : inputs[index + 1];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.select();
  };
  const isVirtualized = filteredStudents.length > 30;
  const rowVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 72,
    overscan: 8,
    enabled: isVirtualized,
  });

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
        ref={listRef}
        className={cn(
          "max-h-150 overflow-y-auto",
          !isVirtualized && "divide-y divide-border/50",
          CARD_STRIPE_INSET,
        )}
        role="list"
        onKeyDown={handleGridKeyDown}
      >
        {filteredStudents.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            {t("examinations.empty.results")}
          </div>
        ) : isVirtualized ? (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: "100%",
              position: "relative",
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const student = filteredStudents[virtualRow.index];
              if (!student) return null;
              return (
                <div
                  key={virtualRow.key}
                  data-index={virtualRow.index}
                  ref={rowVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                  className={cn(
                    virtualRow.index < filteredStudents.length - 1 && "border-b border-border/50",
                  )}
                >
                  <EnterMarksStudentRow
                    student={student}
                    index={virtualRow.index}
                    exam={exam}
                    classNameText={classNamesById.get(student.classId) || student.classId}
                    markValue={marks[String(student.id)] ?? ""}
                    onMarkChange={onMarkChange}
                    readOnly={readOnly}
                  />
                </div>
              );
            })}
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
              readOnly={readOnly}
            />
          ))
        )}
      </div>
    </Card>
  );
}
