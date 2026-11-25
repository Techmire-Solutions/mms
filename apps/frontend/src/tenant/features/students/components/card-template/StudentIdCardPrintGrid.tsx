import React, { type RefObject, type JSX } from "react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { StudentCardTemplate } from "../../lib/studentCardTemplateTypes";
import { StudentCardPrintPreview } from "./StudentCardPrintPreview";
import { StudentIdCardFlipItem } from "./StudentIdCardFlipItem";
import type { StudentIdCardItem } from "../StudentIdCardModal";
import type { StudentCardPrintMode } from "./StudentIdCardPrintControlsBar";

export interface StudentIdCardPrintGridProps {
  printAreaRef: RefObject<HTMLDivElement | null>;
  items: StudentIdCardItem[];
  printMode: StudentCardPrintMode;
  template: StudentCardTemplate;
  madrasaName?: string;
  cutGuideClass: string;
  flippedCards: Record<string, boolean>;
  globalFlipped: boolean;
  onToggleCardFlip: (studentId: string | number) => void;
  t: TranslationFunction;
}

export function StudentIdCardPrintGrid({
  printAreaRef,
  items,
  printMode,
  template,
  madrasaName,
  cutGuideClass,
  flippedCards,
  globalFlipped,
  onToggleCardFlip,
  t,
}: StudentIdCardPrintGridProps): JSX.Element {
  return (
    <div
      ref={printAreaRef}
      data-print-unclamp
      className="id-card-print-container grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-dialog-scroll overflow-y-auto overflow-x-hidden p-2 justify-items-center print:block print:w-auto print:max-h-none print:overflow-visible print:p-0"
    >
      {items.map(({ student, sessionNames, guardianName, emergencyPhone, bloodGroup }) => {
        if (printMode === "both") {
          return (
            <div
              key={student.id}
              className="id-card-both-sides col-span-full w-full flex flex-wrap md:flex-nowrap items-center justify-center gap-4 py-2 break-inside-avoid print:contents"
            >
              {/* Front Side */}
              <div className="id-card-print-page relative group shrink-0 max-w-full">
                <StudentCardPrintPreview
                  template={template}
                  student={student}
                  side="front"
                  sessionNames={sessionNames}
                  guardianName={guardianName}
                  emergencyPhone={emergencyPhone}
                  bloodGroup={bloodGroup}
                  madrasaName={madrasaName}
                  className={cutGuideClass}
                />
                <span className="absolute top-1.5 end-2 text-4xs font-bold uppercase tracking-wider text-muted-foreground print:hidden">
                  {t("students.idCard.frontSide")}
                </span>
              </div>

              {/* Back Side */}
              <div className="id-card-print-page relative group shrink-0 max-w-full">
                <StudentCardPrintPreview
                  template={template}
                  student={student}
                  side="back"
                  sessionNames={sessionNames}
                  guardianName={guardianName}
                  emergencyPhone={emergencyPhone}
                  bloodGroup={bloodGroup}
                  madrasaName={madrasaName}
                  className={cutGuideClass}
                />
                <span className="absolute top-1.5 end-2 text-4xs font-bold uppercase tracking-wider text-muted-foreground print:hidden">
                  {t("students.idCard.backSide")}
                </span>
              </div>
            </div>
          );
        }

        const baseFlipped = printMode === "back";
        const baseSide = globalFlipped ? !baseFlipped : baseFlipped;
        const isFlipped = flippedCards[student.id] ? !baseSide : baseSide;

        return (
          <StudentIdCardFlipItem
            key={student.id}
            student={student}
            template={template}
            sessionNames={sessionNames}
            guardianName={guardianName}
            emergencyPhone={emergencyPhone}
            bloodGroup={bloodGroup}
            madrasaName={madrasaName}
            cutGuideClass={cutGuideClass}
            isFlipped={isFlipped}
            onToggleFlip={() => onToggleCardFlip(student.id)}
            t={t}
          />
        );
      })}
    </div>
  );
}
