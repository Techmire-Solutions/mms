/**
 * @file FinanceTemplateEditor.tsx
 * @description Finance module invoice and fee receipt template editor wrapping the SSOT TemplateEditor.
 */

import React, { useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { TemplateEditor } from "@/components/app/TemplateEditor";
import { getObject, saveObject } from "@/lib/db";
import {
  type DocumentTemplate,
  type DocumentTemplatePreset,
  type TemplateFieldDefinition,
  type TypstFeeReceiptPayload,
  type ZohoInvoicePayload,
} from "@mms/shared";
import {
  mapToTypstFeeReceipt,
  mapToZohoInvoice,
} from "@/components/template-editor/templatePayloadMappers";
import { notify } from "@/lib/notify";
import {
  PRINT_BLUE_DEEP,
  PRINT_BLUE_DIVIDER,
  PRINT_RED_DANGER,
  PRINT_GREEN_SUCCESS,
} from "@/lib/ui/printTemplateStyles";

export const FINANCE_TEMPLATE_STORAGE_KEY = "mms_finance_invoice_template";

export const FINANCE_AVAILABLE_FIELDS: TemplateFieldDefinition<TypstFeeReceiptPayload>[] = [
  { field: "receiptNo", label: "Receipt / Invoice No", sampleValue: "INV-2026-001" },
  { field: "date", label: "Date", sampleValue: "2026-09-12" },
  { field: "institution", label: "Institution Name", sampleValue: "Madrasa Management System" },
  { field: "studentName", label: "Student Name", sampleValue: "Ali Muhammad" },
  { field: "rollNo", label: "Roll Number", sampleValue: "R-1042" },
  { field: "className", label: "Class / Grade", sampleValue: "Hifz Level 2" },
  { field: "totalAmount", label: "Total Amount", sampleValue: "500.00" },
  { field: "paidAmount", label: "Paid Amount", sampleValue: "350.00" },
  { field: "balance", label: "Remaining Balance", sampleValue: "150.00" },
  { field: "paymentMethod", label: "Payment Method", sampleValue: "Bank Transfer" },
  { field: "transactionRef", label: "Reference / Transaction ID", sampleValue: "TXN-882319" },
];

export const DEFAULT_FINANCE_TEMPLATE: DocumentTemplate<TypstFeeReceiptPayload> = {
  pageSize: "A5",
  orientation: "landscape",
  elements: [
    {
      id: "f_inst",
      type: "field",
      field: "institution",
      label: "Madrasa Management System",
      x: 28,
      y: 24,
      w: 320,
      h: 24,
      style: { fontSize: 16, fontWeight: "bold" },
    },
    {
      id: "f_title",
      type: "static",
      label: "سند قبض رسوم دراسية | Fee Payment Receipt",
      x: 28,
      y: 52,
      w: 300,
      h: 18,
      style: { fontSize: 11, color: PRINT_BLUE_DEEP },
    },
    {
      id: "f_div1",
      type: "divider",
      label: "",
      x: 28,
      y: 76,
      w: 738,
      h: 1,
      style: { color: PRINT_BLUE_DIVIDER },
    },
    {
      id: "f_rec",
      type: "field",
      field: "receiptNo",
      label: "REC-2026-0001",
      x: 580,
      y: 24,
      w: 186,
      h: 20,
      style: { fontSize: 12, fontWeight: "bold", color: PRINT_RED_DANGER, textAlign: "right" },
    },
    {
      id: "f_date",
      type: "field",
      field: "date",
      label: "Date: 2026-09-12",
      x: 580,
      y: 48,
      w: 186,
      h: 18,
      style: { fontSize: 10, textAlign: "right" },
    },
    {
      id: "f_stud",
      type: "field",
      field: "studentName",
      label: "Ali Muhammad",
      x: 28,
      y: 92,
      w: 220,
      h: 18,
      style: { fontSize: 11 },
    },
    {
      id: "f_roll",
      type: "field",
      field: "rollNo",
      label: "Roll: R-1042",
      x: 260,
      y: 92,
      w: 180,
      h: 18,
      style: { fontSize: 11 },
    },
    {
      id: "f_class",
      type: "field",
      field: "className",
      label: "Class: Hifz 2",
      x: 460,
      y: 92,
      w: 180,
      h: 18,
      style: { fontSize: 11 },
    },
    {
      id: "f_tot",
      type: "field",
      field: "totalAmount",
      label: "Total: 500.00",
      x: 540,
      y: 160,
      w: 180,
      h: 20,
      style: { fontSize: 13, fontWeight: "bold" },
    },
    {
      id: "f_paid",
      type: "field",
      field: "paidAmount",
      label: "Paid: 350.00",
      x: 540,
      y: 185,
      w: 180,
      h: 20,
      style: { fontSize: 13, fontWeight: "bold", color: PRINT_GREEN_SUCCESS },
    },
    {
      id: "f_bal",
      type: "field",
      field: "balance",
      label: "Balance: 150.00",
      x: 540,
      y: 210,
      w: 180,
      h: 20,
      style: { fontSize: 13, fontWeight: "bold", color: PRINT_RED_DANGER },
    },
    { id: "f_qr", type: "qrcode", label: "QR Code", x: 28, y: 150, w: 80, h: 80 },
  ],
};

export const FINANCE_PRESETS: DocumentTemplatePreset<TypstFeeReceiptPayload>[] = [
  {
    key: "fee_receipt_typst",
    label: "Typst BiDi Fee Receipt (A5)",
    description: "Standard Typst compiled fee voucher layout",
    template: DEFAULT_FINANCE_TEMPLATE,
  },
  {
    key: "finance_a4_invoice",
    label: "Formal Tuition Invoice (A4)",
    description: "Full-page itemized tuition bill",
    template: {
      pageSize: "A4",
      orientation: "portrait",
      elements: [
        {
          id: "a4_inst",
          type: "field",
          field: "institution",
          label: "Madrasa Management System",
          x: 40,
          y: 40,
          w: 400,
          h: 28,
          style: { fontSize: 18, fontWeight: "bold" },
        },
        {
          id: "a4_rec",
          type: "field",
          field: "receiptNo",
          label: "INV-2026-0001",
          x: 500,
          y: 40,
          w: 250,
          h: 22,
          style: { fontSize: 14, fontWeight: "bold", textAlign: "right" },
        },
        {
          id: "a4_date",
          type: "field",
          field: "date",
          label: "2026-09-12",
          x: 500,
          y: 66,
          w: 250,
          h: 18,
          style: { fontSize: 11, textAlign: "right" },
        },
        { id: "a4_div", type: "divider", label: "", x: 40, y: 100, w: 714, h: 1 },
        {
          id: "a4_stud",
          type: "field",
          field: "studentName",
          label: "Ali Muhammad",
          x: 40,
          y: 120,
          w: 300,
          h: 20,
          style: { fontSize: 12 },
        },
        {
          id: "a4_tot",
          type: "field",
          field: "totalAmount",
          label: "Total: 500.00",
          x: 500,
          y: 220,
          w: 250,
          h: 22,
          style: { fontSize: 14, fontWeight: "bold", textAlign: "right" },
        },
      ],
    },
  },
];

export interface FinanceTemplateEditorProps {
  onClose?: () => void;
  fullscreen?: boolean;
}

export function FinanceTemplateEditor({
  onClose = () => {},
  fullscreen = false,
}: FinanceTemplateEditorProps): React.JSX.Element {
  const currentTemplate = useMemo(() => {
    return getObject<DocumentTemplate<TypstFeeReceiptPayload>>(
      FINANCE_TEMPLATE_STORAGE_KEY,
      DEFAULT_FINANCE_TEMPLATE,
    );
  }, []);

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

  const handleSave = (tmpl: DocumentTemplate<TypstFeeReceiptPayload>) => {
    saveObject(FINANCE_TEMPLATE_STORAGE_KEY, tmpl);
    notify.success(t("finance.templateSaved"));
  };

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
    <TemplateEditor<TypstFeeReceiptPayload>
      title={t("finance.templateEditorTitle")}
      template={currentTemplate}
      defaultTemplate={DEFAULT_FINANCE_TEMPLATE}
      availableFields={FINANCE_AVAILABLE_FIELDS}
      presets={FINANCE_PRESETS}
      documentType="invoice"
      sampleData={sampleData}
      fullscreen={fullscreen}
      branding={branding}
      onSave={handleSave}
      onClose={onClose}
      onExportTypst={handleExportTypst}
      onExportZoho={handleExportZoho}
    />
  );
}

export default FinanceTemplateEditor;
