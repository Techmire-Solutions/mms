import React, { useRef, useState, lazy, Suspense, type JSX } from "react";
import { Printer, IdCard, Paintbrush } from "lucide-react";
import { STUDENTS_MODULE_MANIFEST, type Student } from "@mms/shared";
import { Modal } from "@/components/app/Modal";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useStudentCardTemplate } from "../lib/studentCardTemplateStore";
import {
  StudentIdCardPrintControlsBar,
  type StudentCardPrintMode,
} from "./card-template/StudentIdCardPrintControlsBar";
import { StudentIdCardPrintGrid } from "./card-template/StudentIdCardPrintGrid";

const StudentCardTemplateEditor = lazy(() => import("./card-template/StudentCardTemplateEditor"));

export interface StudentIdCardItem {
  student: Student;
  sessionNames: string[];
  guardianName?: string;
  emergencyPhone?: string;
  bloodGroup?: string;
}

export interface StudentIdCardModalProps {
  open: boolean;
  onClose: () => void;
  items: StudentIdCardItem[];
  madrasaName?: string;
}

export function StudentIdCardModal({
  open,
  onClose,
  items,
  madrasaName = "Madrasa Management System",
}: StudentIdCardModalProps): JSX.Element | null {
  const { t } = useTranslation();
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [printMode, setPrintMode] = useState<StudentCardPrintMode>("front");
  const [globalFlipped, setGlobalFlipped] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [showCutGuides, setShowCutGuides] = useState(true);
  const { canEditSetup } = useModulePermissions(STUDENTS_MODULE_MANIFEST);
  const { template } = useStudentCardTemplate();

  if (!open || items.length === 0) return null;

  const handlePrint = () => {
    window.print();
  };

  const isBatch = items.length > 1;

  const toggleCardFlip = (studentId: string | number) => {
    setFlippedCards((prev) => ({
      ...prev,
      [studentId]: !prev[studentId],
    }));
  };

  const cutGuideClass = showCutGuides
    ? "ring-1 ring-dashed ring-muted-foreground/60 print:ring-1 print:ring-dashed print:ring-black/50"
    : "";

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          isBatch
            ? t("students.idCard.batchPrint", { count: items.length })
            : t("students.idCard.title")
        }
        icon={IdCard}
        size="lg"
        footer={
          <>
            {canEditSetup && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditor(true)}
                className="flex items-center gap-2 min-h-11 px-4 font-medium me-auto"
              >
                <Paintbrush className="w-4 h-4" />
                <span>{t("students.idCard.customize")}</span>
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="min-h-11 px-4 font-medium"
            >
              {t("common.cancel")}
            </Button>
            <Button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-2 px-5 min-h-11 font-semibold"
            >
              <Printer className="w-4 h-4" />
              <span>{t("students.idCard.print")}</span>
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <StudentIdCardPrintControlsBar
            printMode={printMode}
            onSelectPrintMode={(mode) => {
              setPrintMode(mode);
              if (mode === "front") setGlobalFlipped(false);
              if (mode === "back") setGlobalFlipped(true);
            }}
            onToggleGlobalFlipped={() => setGlobalFlipped((prev) => !prev)}
            showCutGuides={showCutGuides}
            onToggleShowCutGuides={() => setShowCutGuides((prev) => !prev)}
            t={t}
          />

          <StudentIdCardPrintGrid
            printAreaRef={printAreaRef}
            items={items}
            printMode={printMode}
            template={template}
            madrasaName={madrasaName}
            cutGuideClass={cutGuideClass}
            flippedCards={flippedCards}
            globalFlipped={globalFlipped}
            onToggleCardFlip={toggleCardFlip}
            t={t}
          />
        </div>
      </Modal>

      {showEditor && (
        <Suspense fallback={null}>
          <StudentCardTemplateEditor
            onClose={() => setShowEditor(false)}
            sampleStudent={items[0]?.student}
            sessionNames={items[0]?.sessionNames}
            guardianName={items[0]?.guardianName}
            emergencyPhone={items[0]?.emergencyPhone}
            bloodGroup={items[0]?.bloodGroup}
          />
        </Suspense>
      )}
    </>
  );
}
