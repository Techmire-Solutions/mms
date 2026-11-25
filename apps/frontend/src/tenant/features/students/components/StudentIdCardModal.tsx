import { useEffect, useMemo, useRef, useState, lazy, Suspense, type JSX } from "react";
import { Printer, IdCard, Paintbrush, Loader2 } from "lucide-react";
import { STUDENTS_MODULE_MANIFEST, getPageDimensions, type Student } from "@mms/contracts";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@/components/app/Modal";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useStudentCardTemplate, STUDENT_CARD_TEMPLATE_KEY } from "../lib/studentCardTemplateStore";
import { useIdentityReset } from "@/lib/forms/useIdentityReset";
import { useStudentsByIds } from "../hooks/useStudentsListQueries";
import { documentTemplateQueryKey } from "@/lib/templates/useDocumentTemplates";
import {
  StudentIdCardPrintControlsBar,
  type StudentCardPrintMode,
} from "./card-template/StudentIdCardPrintControlsBar";
import { StudentIdCardPrintGrid } from "./card-template/StudentIdCardPrintGrid";
import { StudentIdCardPrintStyles } from "./card-template/StudentIdCardPrintStyles";

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
  madrasaName,
}: StudentIdCardModalProps): JSX.Element | null {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const printAreaRef = useRef<HTMLDivElement>(null);
  const [showEditor, setShowEditor] = useState(false);
  const [printMode, setPrintMode] = useState<StudentCardPrintMode>("front");
  const [globalFlipped, setGlobalFlipped] = useState(false);
  const [flippedCards, setFlippedCards] = useState<Record<string, boolean>>({});
  const [showCutGuides, setShowCutGuides] = useState(true);
  const [isPrinting, setIsPrinting] = useState(false);
  const { canEditSetup } = useModulePermissions(STUDENTS_MODULE_MANIFEST);
  const { template } = useStudentCardTemplate();

  const cardDimensions = useMemo(
    () => getPageDimensions(template.pageSize || "CR80", template.orientation || "landscape"),
    [template.pageSize, template.orientation],
  );

  const studentIds = useMemo(() => items.map((item) => item.student.id), [items]);
  const { data: freshStudents, refetch: refetchStudents } = useStudentsByIds(studentIds);

  useEffect(() => {
    if (open && studentIds.length > 0) {
      void refetchStudents();
    }
  }, [open, studentIds, refetchStudents]);

  const resolvedItems = useMemo(() => {
    if (!freshStudents || freshStudents.length === 0) return items;
    const freshMap = new Map(freshStudents.map((s) => [String(s.id), s]));
    return items.map((item) => {
      const fresh = freshMap.get(String(item.student.id));
      if (!fresh) return item;
      return {
        ...item,
        student: { ...item.student, ...fresh },
        guardianName: item.guardianName || fresh.fatherName,
        emergencyPhone: item.emergencyPhone || fresh.phone,
      };
    });
  }, [items, freshStudents]);

  // A different print batch must not inherit flips/guides/editor state.
  useIdentityReset(items.map((item) => String(item.student.id)).join(","), () => {
    setShowEditor(false);
    setPrintMode("front");
    setGlobalFlipped(false);
    setFlippedCards({});
    setShowCutGuides(true);
    setIsPrinting(false);
  });

  if (!open || items.length === 0) return null;

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await Promise.allSettled([
        refetchStudents(),
        queryClient.invalidateQueries({
          queryKey: documentTemplateQueryKey(STUDENT_CARD_TEMPLATE_KEY),
        }),
      ]);
    } finally {
      setIsPrinting(false);
      document.body.setAttribute("data-print-modal-active", "true");
      const cleanup = () => {
        document.body.removeAttribute("data-print-modal-active");
        window.removeEventListener("afterprint", cleanup);
      };
      window.addEventListener("afterprint", cleanup);
      try {
        window.print();
      } finally {
        cleanup();
      }
    }
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
      <StudentIdCardPrintStyles
        width={cardDimensions.width}
        height={cardDimensions.height}
        orientation={template.orientation || "landscape"}
      />

      <Modal
        open={open && !showEditor}
        onClose={onClose}
        title={
          isBatch
            ? t("students.idCard.batchPrint", { count: items.length })
            : t("students.idCard.title")
        }
        icon={IdCard}
        size="xl"
        footer={
          <>
            {canEditSetup && (
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowEditor(true)}
                className="flex items-center gap-2 min-h-11 px-4 font-medium me-auto"
              >
                <Paintbrush className="w-4 h-4" aria-hidden />
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
              disabled={isPrinting}
              className="flex items-center gap-2 px-5 min-h-11 font-semibold"
            >
              {isPrinting ? (
                <Loader2 className="w-4 h-4 animate-spin" aria-hidden />
              ) : (
                <Printer className="w-4 h-4" aria-hidden />
              )}
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
              setFlippedCards({});
              setGlobalFlipped(false);
            }}
            onToggleGlobalFlipped={() => setGlobalFlipped((prev) => !prev)}
            showCutGuides={showCutGuides}
            onToggleShowCutGuides={() => setShowCutGuides((prev) => !prev)}
            t={t}
          />

          <StudentIdCardPrintGrid
            printAreaRef={printAreaRef}
            items={resolvedItems}
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
            onClose={() => {
              setShowEditor(false);
              void queryClient.invalidateQueries({
                queryKey: documentTemplateQueryKey(STUDENT_CARD_TEMPLATE_KEY),
              });
            }}
            sampleStudent={resolvedItems[0]?.student}
            sessionNames={resolvedItems[0]?.sessionNames}
            guardianName={resolvedItems[0]?.guardianName}
            emergencyPhone={resolvedItems[0]?.emergencyPhone}
            bloodGroup={resolvedItems[0]?.bloodGroup}
          />
        </Suspense>
      )}
    </>
  );
}
