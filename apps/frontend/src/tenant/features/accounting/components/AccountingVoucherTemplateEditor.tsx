import React, { useMemo } from "react";
import type { DocumentTemplatePreset } from "@mms/shared";
import { DocumentTemplateEditor } from "@/components/ui/DocumentTemplateEditor";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import {
  voucherTemplateDocumentStore,
  type VoucherPrintPayload,
} from "@/tenant/features/accounting/components/voucherTemplateModel";
import {
  buildVoucherTemplate,
  voucherLayoutCopy,
} from "@/tenant/features/accounting/components/voucherTemplateLayout";
import { useVoucherTemplateSampleData } from "@/tenant/features/accounting/hooks/useVoucherTemplateSampleData";

export interface AccountingVoucherTemplateEditorProps {
  onClose: () => void;
  fullscreen?: boolean;
}

export function AccountingVoucherTemplateEditor({
  onClose,
  fullscreen = false,
}: AccountingVoucherTemplateEditorProps): React.JSX.Element {
  const { t } = useTranslation();
  const branding = useBranding();
  const { sampleData, availableFields } = useVoucherTemplateSampleData(branding);
  const copy = useMemo(() => voucherLayoutCopy(t), [t]);
  const a6 = useMemo(() => buildVoucherTemplate("A6", copy), [copy]);

  const presets = useMemo<DocumentTemplatePreset<VoucherPrintPayload>[]>(
    () => [
      { key: "a6", label: t("accounting.voucherTemplate.presetA6"), description: t("accounting.voucherTemplate.presetA6Description"), template: a6 },
      { key: "a5", label: t("accounting.voucherTemplate.presetA5"), description: t("accounting.voucherTemplate.presetA5Description"), template: buildVoucherTemplate("A5", copy) },
    ],
    [a6, copy, t],
  );

  return (
    <DocumentTemplateEditor<VoucherPrintPayload>
      store={voucherTemplateDocumentStore}
      savedMessage={t("accounting.voucherTemplate.saved")}
      title={t("accounting.voucherTemplate.title")}
      defaultTemplate={a6}
      availableFields={availableFields}
      presets={presets}
      documentType="voucher"
      sampleData={sampleData}
      fullscreen={fullscreen}
      branding={branding}
      onClose={onClose}
    />
  );
}

export default AccountingVoucherTemplateEditor;
