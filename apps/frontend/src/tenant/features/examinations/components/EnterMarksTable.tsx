import React, { useCallback, useDeferredValue, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Users, Search } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { FORM_INPUT_COMPACT } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { cn } from "@/lib/utils";
import { CARD_STRIPE_INSET } from "@/lib/ui/semanticTone";
import { EnterMarksStudentRow } from "./EnterMarksStudentRow";
import { resolveMarksGridTarget, type MarksGridNavigationKey } from "../lib/marksGridNavigation";
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
  // Filtering runs over the whole roster on every keystroke; defer it so the focused input stays
  // responsive while a large roster is filtered.
  const deferredQuery = useDeferredValue(searchQuery);
  const filteredStudents = useMemo(() => {
    const query = deferredQuery.trim().toLowerCase();
    if (!query) return students;
    return students.filter(
      (s) =>
        (s.name && s.name.toLowerCase().includes(query)) ||
        (s.rollNo && s.rollNo.toLowerCase().includes(query)),
    );
  }, [students, deferredQuery]);

  const listRef = useRef<HTMLDivElement | null>(null);

  const isVirtualized = filteredStudents.length > 30;
  const rowVirtualizer = useVirtualizer({
    count: filteredStudents.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => 72,
    overscan: 8,
    enabled: isVirtualized,
  });

  /**
   * Enter/ArrowDown/ArrowUp/Tab move through the whole filtered roster, not just the mounted
   * virtual window: compute the target index, scroll it into view, then focus its input.
   */
  const handleGridKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLDivElement>): void => {
      const key = event.key as MarksGridNavigationKey;
      if (!["Tab", "Enter", "ArrowDown", "ArrowUp", "Home", "End"].includes(key)) return;
      const target = event.target as HTMLInputElement;
      if (target.tagName !== "INPUT" || !target.hasAttribute("data-marks-input")) return;
      const current = Number(target.dataset.marksIndex ?? "-1");
      const next = resolveMarksGridTarget(current, key, event.shiftKey, filteredStudents.length);
      if (next === null) return;
      event.preventDefault();
      const student = filteredStudents[next];
      if (!student) return;
      const inputId = `marks-${student.id}`;
      if (isVirtualized) {
        rowVirtualizer.scrollToIndex(next, { align: "auto" });
        // The row mounts on the virtualizer's next render; focus after that paint.
        requestAnimationFrame(() => {
          document.getElementById(inputId)?.focus();
        });
      } else {
        document.getElementById(inputId)?.focus();
      }
    },
    [filteredStudents, isVirtualized, rowVirtualizer],
  );

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
                    position={virtualRow.index}
                    total={filteredStudents.length}
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
              position={index}
              total={filteredStudents.length}
            />
          ))
        )}
      </div>
    </Card>
  );
}
