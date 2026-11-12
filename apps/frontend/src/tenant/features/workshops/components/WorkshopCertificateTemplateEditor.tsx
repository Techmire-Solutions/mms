import React from "react";
import { DocumentTemplateEditor } from "@/components/app/DocumentTemplateEditor";
import { useTranslation } from "@/hooks/useTranslation";
import {
  buildWorkshopCertificatePayload,
  DEFAULT_WORKSHOP_CERTIFICATE_TEMPLATE,
  WORKSHOP_CERTIFICATE_FIELDS,
  WORKSHOP_CERTIFICATE_TEMPLATE_KEY,
} from "../lib/workshopCertificateTemplate";

export interface WorkshopCertificateTemplateEditorProps {
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
  fullscreen?: boolean;
}

/** Setup wrapper that persists the certificate layout through the generic template API. */
export function WorkshopCertificateTemplateEditor({
  onClose,
  onDirtyChange,
  fullscreen = false,
}: WorkshopCertificateTemplateEditorProps): React.JSX.Element {
  const { t } = useTranslation();
  const sampleData = buildWorkshopCertificatePayload(
    {
      contactName: "Amina Rahman",
      certificateIssuedAt: "2099-03-03T09:00:00.000Z",
      completedAt: "2099-03-02T10:00:00.000Z",
    },
    { title: "Advanced Calligraphy", startDate: "2099-03-01", endDate: "2099-03-02" },
    {
      heading: t("workshops.certificate.heading"),
      statement: t("workshops.certificate.statement"),
      issuedLabel: t("workshops.certificate.issuedOn"),
    },
  );

  return (
    <DocumentTemplateEditor
      templateKey={WORKSHOP_CERTIFICATE_TEMPLATE_KEY}
      defaultTemplate={DEFAULT_WORKSHOP_CERTIFICATE_TEMPLATE}
      title={t("workshops.certificateTemplate.title")}
      savedMessage={t("workshops.certificateTemplate.saved")}
      availableFields={WORKSHOP_CERTIFICATE_FIELDS}
      sampleData={sampleData}
      onClose={onClose}
      onDirtyChange={onDirtyChange}
      fullscreen={fullscreen}
    />
  );
}
