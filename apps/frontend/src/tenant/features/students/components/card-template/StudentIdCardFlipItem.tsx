import React from "react";
import { RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Student } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { StudentCardTemplate } from "../../lib/studentCardTemplateTypes";
import { StudentCardPrintPreview } from "./StudentCardPrintPreview";

export interface StudentIdCardFlipItemProps {
  student: Student;
  template: StudentCardTemplate;
  sessionNames?: string[];
  guardianName?: string;
  emergencyPhone?: string;
  bloodGroup?: string;
  madrasaName?: string;
  cutGuideClass?: string;
  isFlipped: boolean;
  onToggleFlip: () => void;
  t: TranslationFunction;
}

export function StudentIdCardFlipItem({
  student,
  template,
  sessionNames,
  guardianName,
  emergencyPhone,
  bloodGroup,
  madrasaName,
  cutGuideClass = "",
  isFlipped,
  onToggleFlip,
  t,
}: StudentIdCardFlipItemProps): React.JSX.Element {
  return (
    <div className="relative group">
      <div
        style={{ perspective: 1000 }}
        className="relative cursor-pointer select-none"
        onClick={onToggleFlip}
        title={t("students.idCard.flipCard")}
      >
        <div
          style={{
            transformStyle: "preserve-3d",
            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
            transition: "transform 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
          className="relative"
        >
          {/* Front face */}
          <div style={{ backfaceVisibility: "hidden" }}>
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
          </div>

          {/* Back face */}
          <div
            style={{
              backfaceVisibility: "hidden",
              transform: "rotateY(180deg)",
              position: "absolute",
              inset: 0,
            }}
          >
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
          </div>
        </div>
      </div>

      {/* Quick flip badge */}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={(e) => {
          e.stopPropagation();
          onToggleFlip();
        }}
        className="absolute top-2 end-2 bg-background/80 hover:bg-background border border-border/80 shadow-2xs text-muted-foreground hover:text-foreground opacity-75 hover:opacity-100 transition-all print:hidden"
        title={t("students.idCard.flipCard")}
        aria-label={t("students.idCard.flipCard")}
        icon={RotateCw}
      />

    </div>
  );
}

export default StudentIdCardFlipItem;
