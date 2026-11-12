import React, { useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import { getPageDimensions, type WorkshopCompletionRow, type WorkshopEvent } from "@mms/shared";
import { Modal } from "@/components/app/Modal";
import { Button } from "@/components/ui/button";
import { TemplateDocumentPreview } from "@/components/template-editor/TemplateDocumentPreview";
import { printTemplateDocument } from "@/components/template-editor/templateDocumentPrint";
import { useDocumentTemplate } from "@/lib/templates/useDocumentTemplates";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  buildWorkshopCertificatePayload,
  DEFAULT_WORKSHOP_CERTIFICATE_TEMPLATE,
  WORKSHOP_CERTIFICATE_TEMPLATE_KEY,
} from "../lib/workshopCertificateTemplate";

/** One printed batch is bounded so a large cohort never builds an O(n)-page DOM. */
export const MAX_CERTIFICATES_PER_PRINT_BATCH = 50;

export interface WorkshopCertificatePrintModalProps {
  workshop: WorkshopEvent;
  rows: WorkshopCompletionRow[];
  onClose: () => void;
}

/**
 * Template-driven certificate print surface.
 *
 * The current page of at most 50 certificates is rendered with `TemplateDocumentPreview` and
 * printed through `printTemplateDocument`, which carries the app language/isRtl into the print
 * window. Larger cohorts page through batches instead of materialising every certificate at once.
 */
export function WorkshopCertificatePrintModal({
  workshop,
  rows,
  onClose,
}: WorkshopCertificatePrintModalProps): React.JSX.Element {
  const { t, language, isRtl } = useTranslation();
  const { template } = useDocumentTemplate(
    WORKSHOP_CERTIFICATE_TEMPLATE_KEY,
    DEFAULT_WORKSHOP_CERTIFICATE_TEMPLATE,
  );
  const [batchIndex, setBatchIndex] = useState(0);
  const [prevRows, setPrevRows] = useState(rows);
  if (prevRows !== rows) {
    setPrevRows(rows);
    setBatchIndex(0);
  }
  const previewRef = useRef<HTMLDivElement>(null);
  const batchCount = Math.max(1, Math.ceil(rows.length / MAX_CERTIFICATES_PER_PRINT_BATCH));
  const batch = useMemo(
    () =>
      rows.slice(
        batchIndex * MAX_CERTIFICATES_PER_PRINT_BATCH,
        (batchIndex + 1) * MAX_CERTIFICATES_PER_PRINT_BATCH,
      ),
    [batchIndex, rows],
  );
  const size = getPageDimensions(template.pageSize, template.orientation);

  const printed = useMemo(
    () =>
      batch.map((row) =>
        buildWorkshopCertificatePayload(row, workshop, {
          heading: t("workshops.certificate.heading"),
          statement: t("workshops.certificate.statement"),
          issuedLabel: t("workshops.certificate.issuedOn"),
        }),
      ),
    [batch, t, workshop],
  );

  const handlePrint = () => {
    const ok = printTemplateDocument({
      previewElement: previewRef.current,
      template,
      windowTitle: t("workshops.certificate.heading"),
      language,
      isRtl,
    });
    if (!ok) notify.error(t("workshops.certificate.printFailed"));
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t("workshops.certificate.printTitle")}
      subtitle={t("workshops.certificate.printCount", { count: rows.length })}
      icon={Printer}
      size="lg"
      footer={
        <div className="flex w-full flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={batchIndex === 0}
              onClick={() => setBatchIndex((index) => Math.max(0, index - 1))}
            >
              <ChevronLeft className="size-4" aria-hidden />
              {t("common.previous")}
            </Button>
            <span className="text-xs text-muted-foreground">
              {t("workshops.certificate.printBatch", {
                current: batchIndex + 1,
                total: batchCount,
              })}
            </span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={batchIndex >= batchCount - 1}
              onClick={() => setBatchIndex((index) => Math.min(batchCount - 1, index + 1))}
            >
              {t("common.next")}
              <ChevronRight className="size-4" aria-hidden />
            </Button>
          </div>
          <Button type="button" icon={Printer} onClick={handlePrint}>
            {t("workshops.certificate.print")}
          </Button>
        </div>
      }
    >
      <div className="max-h-[70vh] overflow-auto bg-muted/30 p-4">
        <div ref={previewRef} className="mx-auto space-y-6" style={{ width: size.width }}>
          {printed.map((payload, index) => (
            <TemplateDocumentPreview
              key={batch[index]?.participantId ?? index}
              template={template}
              data={payload}
              isRtl={isRtl}
              showBoundary={false}
              breakAfter={index < printed.length - 1}
            />
          ))}
        </div>
      </div>
    </Modal>
  );
}
