/**
 * @file TermReportCardModal.tsx
 * @description Print a term-wide report card from a selected set of a student's papers.
 *
 * There is no term entity: the picker defaults to the current paper plus papers sharing
 * its exam name, and the admin can adjust the set before printing the stored template.
 */

import React, { useMemo, useRef, useState } from "react";
import { resolveResultScore } from "@mms/shared";
import { FileStack, Printer } from "lucide-react";
import { formatDate, getPageDimensions } from "@mms/shared";
import { Modal } from "@/components/app/Modal";
import { Button } from "@/components/ui/button";
import { CheckboxField } from "@/components/ui/checkbox";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { notify } from "@/lib/notify";
import { useDocumentTemplate } from "@/lib/templates/useDocumentTemplates";
import { TemplateDocumentPreview } from "@/components/template-editor/TemplateDocumentPreview";
import { printTemplateDocument } from "@/components/template-editor/templateDocumentPrint";
import {
  DEFAULT_EXAMINATION_TEMPLATE,
  EXAMINATION_TEMPLATE_STORAGE_KEY,
} from "@/tenant/features/examinations/lib/examinationTemplateData";
import {
  buildTermReportCardPayload,
  type ReportCardResultInput,
} from "@/tenant/features/examinations/lib/reportCardPayload";
import type { StudentExamPaper } from "@/tenant/features/examinations/lib/studentExamPapers";

export interface TermReportCardModalProps {
  result: ReportCardResultInput;
  papers: readonly StudentExamPaper[];
  /** Paper whose result card opened this modal; always preselected. */
  currentExamId: string;
  onClose: () => void;
}

function initialSelection(papers: readonly StudentExamPaper[], currentExamId: string): Set<string> {
  const current = papers.find((paper) => paper.exam.id === currentExamId);
  const termName = current?.exam.name;
  const preselected = papers.filter(
    (paper) => paper.exam.id === currentExamId || paper.exam.name === termName,
  );
  return new Set(preselected.map((paper) => paper.exam.id));
}

export function TermReportCardModal({
  result,
  papers,
  currentExamId,
  onClose,
}: TermReportCardModalProps): React.JSX.Element {
  const { t, language, isRtl } = useTranslation();
  const branding = useBranding();
  const { template } = useDocumentTemplate(
    EXAMINATION_TEMPLATE_STORAGE_KEY,
    DEFAULT_EXAMINATION_TEMPLATE,
  );
  const printRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() =>
    initialSelection(papers, currentExamId),
  );

  const selectedPapers = useMemo(
    () => papers.filter((paper) => selectedIds.has(paper.exam.id)),
    [papers, selectedIds],
  );
  const size = getPageDimensions(template.pageSize, template.orientation);
  const payload = useMemo(
    () =>
      buildTermReportCardPayload({
        result,
        papers: selectedPapers,
        institution: branding.madrasaName,
        mixedTermLabel: t("examinations.termReportCard.mixedTerm"),
      }),
    [branding.madrasaName, result, selectedPapers, t],
  );

  const allSelected = papers.length > 0 && selectedIds.size === papers.length;
  const someSelected = selectedIds.size > 0 && !allSelected;

  const togglePaper = (examId: string, checked: boolean) => {
    setSelectedIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(examId);
      else next.delete(examId);
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(papers.map((paper) => paper.exam.id)) : new Set());
  };

  const handlePrint = () => {
    if (selectedPapers.length === 0) return;
    const printed = printTemplateDocument({
      previewElement: printRef.current,
      template,
      windowTitle: t("examinations.termReportCard.print"),
      language,
      isRtl,
    });
    if (!printed) notify.error(t("templateEditor.exportFailed"));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("examinations.termReportCard.title")}
      subtitle={`${result.student?.name ?? ""} · ${result.cls?.name ?? ""}`}
      icon={FileStack}
      size="lg"
      footer={
        <div className="flex w-full justify-end gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button type="button" onClick={handlePrint} disabled={selectedPapers.length === 0}>
            <Printer className="w-4 h-4" aria-hidden="true" />
            {t("examinations.termReportCard.print")}
          </Button>
        </div>
      }
    >
      {/* Offscreen 1:1 page — the print source. */}
      <div
        aria-hidden="true"
        style={{
          position: "fixed",
          top: -99999,
          left: -99999,
          pointerEvents: "none",
          zIndex: -9999,
        }}
      >
        <div ref={printRef} style={{ direction: isRtl ? "rtl" : "ltr" }}>
          <TemplateDocumentPreview
            template={template}
            data={payload}
            logoUrl={branding.logoUrl}
            isRtl={isRtl}
            showBoundary={false}
          />
        </div>
      </div>

      <div className="space-y-4">
        {papers.length === 0 ? (
          <p className="text-sm text-muted-foreground m-0">
            {t("examinations.termReportCard.noPapers")}
          </p>
        ) : (
          <div className="space-y-1">
            <CheckboxField
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={toggleAll}
              label={t("examinations.termReportCard.selectAll")}
            />
            <div role="group" aria-label={t("examinations.termReportCard.papers")}>
              {papers.map(({ exam, result: paperResult }) => {
                const pct = resolveResultScore({
                  marksObtained: paperResult.marksObtained,
                  totalMarks: exam.totalMarks,
                  passingMarks: exam.passingMarks,
                  graceMarks: "graceMarks" in paperResult ? paperResult.graceMarks : undefined,
                }).displayPercentage;
                return (
                  <CheckboxField
                    key={exam.id}
                    checked={selectedIds.has(exam.id)}
                    onCheckedChange={(checked) => togglePaper(exam.id, checked)}
                    label={
                      <span className="flex min-w-0 items-center justify-between gap-2">
                        <span className="truncate">{exam.subject || exam.name}</span>
                        <span className="shrink-0 font-mono text-xs">
                          {`${paperResult.marksObtained}/${exam.totalMarks} · ${pct}%`}
                        </span>
                      </span>
                    }
                    description={`${exam.name} · ${formatDate(exam.date, true)}`}
                  />
                );
              })}
            </div>
          </div>
        )}

        <p role="status" className="m-0 text-sm font-semibold text-foreground">
          {t("examinations.termReportCard.summary", {
            papers: selectedPapers.length,
            obtained: payload.obtainedMarks,
            total: payload.totalMarks,
            percentage: payload.percentage,
          })}
        </p>

        <div
          className="max-h-[50dvh] overflow-auto rounded-xl border border-dashed border-border bg-muted/20 p-4"
          style={{ direction: isRtl ? "rtl" : "ltr" }}
        >
          <div className="mx-auto" style={{ width: size.width, height: size.height }}>
            <TemplateDocumentPreview
              template={template}
              data={payload}
              logoUrl={branding.logoUrl}
              isRtl={isRtl}
              showBoundary
            />
          </div>
        </div>
      </div>
    </Modal>
  );
}

export default TermReportCardModal;
