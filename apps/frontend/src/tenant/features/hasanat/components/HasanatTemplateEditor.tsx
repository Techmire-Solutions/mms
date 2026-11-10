/**
 * @file HasanatTemplateEditor.tsx
 * @description Hasanat module donation receipt and distribution voucher template editor.
 */

import React, { useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useBranding } from "@/tenant/hooks/useBranding";
import { DocumentTemplateEditor } from "@/components/app/DocumentTemplateEditor";
import {
  localizeTemplateFields,
  localizeTemplatePresets,
} from "@/components/template-editor/templateLocalization";
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
    qrPayload: "hd-2026-904|50 Hasanat|" + new Date().toISOString().slice(0, 10),
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
  const availableFields = useMemo(
    () =>
      localizeTemplateFields(
        HASANAT_AVAILABLE_FIELDS,
        (field) => `hasanat.templateField.${String(field.field)}`,
        t,
      ),
    [t],
  );
  const presets = useMemo(
    () =>
      localizeTemplatePresets(
        HASANAT_PRESETS,
        (preset) => `hasanat.templatePreset.${preset.key}`,
        t,
      ),
    [t],
  );

  return (
    <div className="min-w-0">
      <DocumentTemplateEditor<HasanatPayload>
        templateKey={HASANAT_TEMPLATE_STORAGE_KEY}
        defaultTemplate={DEFAULT_HASANAT_TEMPLATE}
        savedMessage={t("hasanat.templateSaved")}
        title={t("hasanat.templateEditorTitle")}
        availableFields={availableFields}
        presets={presets}
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
