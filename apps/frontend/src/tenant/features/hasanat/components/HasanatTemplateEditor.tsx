/**
 * @file HasanatTemplateEditor.tsx
 * @description Hasanat module donation receipt and distribution voucher template editor.
 */

import React from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { DocumentTemplateEditor } from "@/components/app/DocumentTemplateEditor";
import {
  DEFAULT_HASANAT_TEMPLATE,
  HASANAT_AVAILABLE_FIELDS,
  HASANAT_PRESETS,
  HASANAT_TEMPLATE_STORAGE_KEY,
  type HasanatPayload,
} from "@/tenant/features/hasanat/lib/hasanatTemplateData";

export interface HasanatTemplateEditorProps {
  /** Leaving the Templates sub-tab (or closing the modal). */
  onClose: () => void;
  /** Reports unsaved layout changes to the Setup leave-guard. */
  onDirtyChange?: (dirty: boolean) => void;
  fullscreen?: boolean;
}

export function HasanatTemplateEditor({
  onClose,
  onDirtyChange,
  fullscreen = false,
}: HasanatTemplateEditorProps): React.JSX.Element {
  const sampleData: HasanatPayload = {
    institution: "Madrasa Management System",
    receiptNo: "HAS-2026-904",
    donorName: "Hajj Ahmad",
    recipientName: "Zaid bin Harith",
    denomination: "Silver Deed (10 Pts)",
    totalPoints: "50 Hasanat",
    issueDate: new Date().toISOString().slice(0, 10),
    expiryDate: "2027-09-12",
    purpose: "Quranic Excellence Reward",
    issuedBy: "Admin Office",
  };

  const { t } = useTranslation();
  const branding = useBranding();

  return (
    <div className="min-w-0">
      <DocumentTemplateEditor<HasanatPayload>
        templateKey={HASANAT_TEMPLATE_STORAGE_KEY}
        defaultTemplate={DEFAULT_HASANAT_TEMPLATE}
        savedMessage={t("hasanat.templateSaved")}
        title={t("hasanat.templateEditorTitle")}
        availableFields={HASANAT_AVAILABLE_FIELDS}
        presets={HASANAT_PRESETS}
        documentType="voucher"
        sampleData={sampleData}
        fullscreen={fullscreen}
        branding={branding}
        onClose={onClose}
        onDirtyChange={onDirtyChange}
      />
    </div>
  );
}

export default HasanatTemplateEditor;
