/**
 * @file FinanceTemplateEditor.tsx
 * @description Finance module invoice and fee receipt template editor.
 *
 * Persistence lives in `DocumentTemplateEditor` (`/api/templates/:key`); this wrapper
 * only supplies finance's fields, presets, sample payload and data exports.
 */

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { DocumentTemplateEditor } from "@/components/app/DocumentTemplateEditor";
import { TemplateEditorGapNotice } from "@/components/app/TemplateEditorGapNotice";
import { type TypstFeeReceiptPayload, type ZohoInvoicePayload } from "@mms/shared";
import {
  mapToTypstFeeReceipt,
  mapToZohoInvoice,
} from "@/components/template-editor/templatePayloadMappers";
import { notify } from "@/lib/notify";
import {
  FINANCE_TEMPLATE_STORAGE_KEY,
  FINANCE_AVAILABLE_FIELDS,
  DEFAULT_FINANCE_TEMPLATE,
  FINANCE_PRESETS,
} from "@/tenant/features/finance/lib/financeTemplateData";

export interface FinanceTemplateEditorProps {
  /** Leaving the Templates sub-tab (or closing the modal). */
  onClose: () => void;
  /** Reports unsaved layout changes to the Setup leave-guard. */
  onDirtyChange?: (dirty: boolean) => void;
  fullscreen?: boolean;
}

export function FinanceTemplateEditor({
  onClose,
  onDirtyChange,
  fullscreen = false,
}: FinanceTemplateEditorProps): React.JSX.Element {
  const sampleData: TypstFeeReceiptPayload = {
    institution: "Madrasa Management System",
    receiptNo: "REC-2026-0089",
    date: new Date().toISOString().slice(0, 10),
    studentName: "Muhammad Ibrahim",
    rollNo: "STU-4402",
    className: "Class 4 - Afternoon",
    feeItems: [
      { description: "Monthly Tuition Fee", amount: "300.00", paid: "300.00" },
      { description: "Textbooks & Syllabus", amount: "100.00", paid: "50.00" },
    ],
    totalAmount: "400.00",
    paidAmount: "350.00",
    balance: "50.00",
    paymentMethod: "Online Card",
    transactionRef: "STRIPE_CH_991823",
  };

  const { t } = useTranslation();
  const branding = useBranding();

  const handleExportTypst = (payload: TypstFeeReceiptPayload) => {
    const conforming = mapToTypstFeeReceipt({ ...payload });
    const jsonStr = JSON.stringify(conforming, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `typst-fee-receipt-${conforming.receiptNo}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify.success(t("templateEditor.typstExported"));
  };

  const handleExportZoho = (zohoPayload: ZohoInvoicePayload) => {
    const conforming = mapToZohoInvoice({ ...zohoPayload });
    const jsonStr = JSON.stringify(conforming, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `zoho-invoice-${conforming.invoice_number}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
    notify.success(t("finance.zohoExported"));
  };

  return (
    <div className="min-w-0">
      {!fullscreen && <TemplateEditorGapNotice t={t} />}
      <DocumentTemplateEditor<TypstFeeReceiptPayload>
        templateKey={FINANCE_TEMPLATE_STORAGE_KEY}
        defaultTemplate={DEFAULT_FINANCE_TEMPLATE}
        savedMessage={t("finance.templateSaved")}
        title={t("finance.templateEditorTitle")}
        availableFields={FINANCE_AVAILABLE_FIELDS}
        presets={FINANCE_PRESETS}
        documentType="invoice"
        sampleData={sampleData}
        fullscreen={fullscreen}
        branding={branding}
        onClose={onClose}
        onDirtyChange={onDirtyChange}
        onExportTypst={handleExportTypst}
        onExportZoho={handleExportZoho}
      />
    </div>
  );
}

export default FinanceTemplateEditor;
