import React, { useRef } from "react";
import { Printer, Send } from "lucide-react";
import type { Denomination, Distribution } from "@/lib/data/hasanatData";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { Button } from "@/components/ui/button";
import { notify } from "@/lib/notify";
import { useDocumentTemplate } from "@/lib/templates/useDocumentTemplates";
import { TemplateDocumentPreview } from "@/components/template-editor/TemplateDocumentPreview";
import { printTemplateDocument } from "@/components/template-editor/templateDocumentPrint";
import {
  DEFAULT_HASANAT_TEMPLATE,
  HASANAT_TEMPLATE_STORAGE_KEY,
} from "@/tenant/features/hasanat/lib/hasanatTemplateData";
import { buildHasanatVoucherPayload } from "@/tenant/features/hasanat/lib/hasanatVoucherPayload";
import { DetailDrawerShell } from "@/components/app/DetailDrawerShell";
import {
  DetailDrawerArchivedBanner,
  DetailDrawerRestoreOrEditAction,
} from "@/components/app/DetailDrawerArchiveChrome";
import { DetailSectionCard } from "@/components/app/DetailSectionCard";
import { DetailAttributeRow } from "@/components/app/DetailAttributeRow";

export interface DistributionDetailProps {
  distribution: Distribution;
  /** Denomination of the issued batch, used to compute the voucher's total points. */
  denomination?: Denomination | null;
  onClose: () => void;
  onEdit?: (distribution: Distribution) => void;
  canDelete?: boolean;
  onRestore?: (id: string) => void | Promise<void>;
}

export const DistributionDetail = function DistributionDetail({
  distribution,
  denomination = null,
  onClose,
  onEdit,
  canDelete = false,
  onRestore,
}: DistributionDetailProps) {
  const { t, language, isRtl } = useTranslation();
  const branding = useBranding();
  const { template } = useDocumentTemplate(HASANAT_TEMPLATE_STORAGE_KEY, DEFAULT_HASANAT_TEMPLATE);
  const printRef = useRef<HTMLDivElement>(null);
  const isArchived = !!distribution.deletedAt;
  const voucherPayload = buildHasanatVoucherPayload({
    distribution,
    denomination,
    institution: branding.madrasaName,
  });

  return (
    <DetailDrawerShell
      open
      onClose={onClose}
      title={t("hasanat.detail.title")}
      subtitle={distribution.recipientName || "Recipient"}
      icon={Send}
      headerExtra={isArchived && <DetailDrawerArchivedBanner deletedAt={distribution.deletedAt} />}
      headerActions={
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 px-3 text-xs"
            onClick={() => {
              const printed = printTemplateDocument({
                previewElement: printRef.current,
                template,
                windowTitle: t("hasanat.detail.printVoucher"),
                language,
                isRtl,
              });
              if (!printed) notify.error(t("templateEditor.exportFailed"));
            }}
          >
            <Printer className="w-3.5 h-3.5" aria-hidden="true" />
            {t("hasanat.detail.printVoucher")}
          </Button>
          <DetailDrawerRestoreOrEditAction
            isArchived={isArchived}
            canEdit={!!onEdit}
            canRestore={canDelete}
            onEdit={() => onEdit?.(distribution)}
            onRestore={() => onRestore?.(distribution.id)}
            restoreLabel={t("common.restore")}
            editLabel={t("common.edit")}
          />
        </div>
      }
    >
      {/* Offscreen 1:1 voucher — the designed template is what prints. */}
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
        <div ref={printRef}>
          <TemplateDocumentPreview
            template={template}
            data={voucherPayload}
            logoUrl={branding.logoUrl}
            isRtl={isRtl}
            showBoundary={false}
          />
        </div>
      </div>

      <div className="flex flex-col gap-6 py-6">
        <DetailSectionCard
          title={t("hasanat.detail.overview")}
          className="overflow-hidden divide-y divide-border"
        >
          <DetailAttributeRow
            label={t("hasanat.fields.denomination")}
            value={distribution.denominationName}
          />
          <DetailAttributeRow
            label={t("hasanat.fields.recipient")}
            value={distribution.recipientName}
          />
          <DetailAttributeRow label={t("hasanat.fields.quantity")} value={distribution.quantity} />
          <DetailAttributeRow label={t("hasanat.fields.status")} value={distribution.status} />
          <DetailAttributeRow
            label={t("hasanat.fields.issuedDate")}
            value={distribution.issuedDate}
          />
          <DetailAttributeRow
            label={t("hasanat.fields.issuedBy")}
            value={distribution.issuedBy || "—"}
          />
          <DetailAttributeRow
            label={t("hasanat.fields.reason")}
            value={distribution.reason || "—"}
          />
        </DetailSectionCard>
      </div>
    </DetailDrawerShell>
  );
};
