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
  madrasaName: string;
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
      className="id-card-print-container grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-dialog-scroll overflow-y-auto p-2 print:grid-cols-2 print:gap-3 print:max-h-none print:overflow-visible print:p-0"
    >
      {items.map(({ student, sessionNames, guardianName, emergencyPhone, bloodGroup }) => {
        if (printMode === "both") {
          return (
            <React.Fragment key={student.id}>
              {/* Front Side */}
              <div className="relative group">
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
              <div className="relative group">
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
            </React.Fragment>
          );
        }

        const isFlipped =
          printMode === "back"
            ? !flippedCards[student.id]
            : Boolean(flippedCards[student.id] !== globalFlipped);

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
