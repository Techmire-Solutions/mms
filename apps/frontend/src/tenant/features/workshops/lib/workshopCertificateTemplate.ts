import {
  formatDate,
  todayISO,
  type DocumentTemplate,
  type TemplateFieldDefinition,
  type WorkshopCompletionRow,
  type WorkshopEvent,
} from "@mms/shared";
import { PRINT_NEUTRAL } from "@/lib/ui/printBrandingTokens";
import { formatWorkshopDates } from "../components/workshopsWorkColumns";

/**
 * Certificate payload + factory layout for the shared document-template engine.
 *
 * Elements bind to fields (no `{{token}}` strings), so a missing field is caught by the
 * field-list test instead of silently printing an empty certificate. The template is
 * tenant-saved through `/api/templates/:key` like every other printable document.
 */
export interface WorkshopCertificatePayload {
  heading: string;
  statement: string;
  recipientName: string;
  courseName: string;
  period: string;
  issuedLabel: string;
  issuedOn: string;
}

export const WORKSHOP_CERTIFICATE_TEMPLATE_KEY = "mms_workshop_certificate_template";

export const WORKSHOP_CERTIFICATE_FIELDS: TemplateFieldDefinition<WorkshopCertificatePayload>[] = [
  { field: "heading", label: "Certificate heading", sampleValue: "Certificate of Completion" },
  { field: "statement", label: "Statement", sampleValue: "This certifies that" },
  { field: "recipientName", label: "Recipient name", sampleValue: "Amina Rahman" },
  { field: "courseName", label: "Workshop / course", sampleValue: "Advanced Calligraphy" },
  { field: "period", label: "Workshop dates", sampleValue: "1 – 2 March 2099" },
  { field: "issuedLabel", label: "Issued label", sampleValue: "Issued on" },
  { field: "issuedOn", label: "Issued date", sampleValue: "3 March 2099" },
];

export const DEFAULT_WORKSHOP_CERTIFICATE_TEMPLATE: DocumentTemplate<WorkshopCertificatePayload> = {
  pageSize: "A4",
  orientation: "landscape",
  elements: [
    {
      id: "cert_heading",
      type: "field",
      field: "heading",
      label: "Certificate of Completion",
      x: 80,
      y: 100,
      w: 963,
      h: 70,
      style: {
        fontSize: 36,
        fontWeight: "bold",
        textAlign: "center",
        color: PRINT_NEUTRAL.emphasis,
      },
    },
    {
      id: "cert_divider",
      type: "divider",
      label: "",
      x: 160,
      y: 185,
      w: 803,
      h: 2,
      style: { color: PRINT_NEUTRAL.border },
    },
    {
      id: "cert_statement",
      type: "field",
      field: "statement",
      label: "This certifies that",
      x: 80,
      y: 210,
      w: 963,
      h: 40,
      style: { fontSize: 16, textAlign: "center", color: PRINT_NEUTRAL.body },
    },
    {
      id: "cert_recipient",
      type: "field",
      field: "recipientName",
      label: "Amina Rahman",
      x: 80,
      y: 270,
      w: 963,
      h: 80,
      style: {
        fontSize: 40,
        fontWeight: "bold",
        textAlign: "center",
        color: PRINT_NEUTRAL.emphasis,
      },
    },
    {
      id: "cert_course",
      type: "field",
      field: "courseName",
      label: "Advanced Calligraphy",
      x: 80,
      y: 380,
      w: 963,
      h: 40,
      style: { fontSize: 22, textAlign: "center", color: PRINT_NEUTRAL.emphasis },
    },
    {
      id: "cert_period",
      type: "field",
      field: "period",
      label: "1 – 2 March 2099",
      x: 80,
      y: 430,
      w: 963,
      h: 24,
      style: { fontSize: 13, textAlign: "center", color: PRINT_NEUTRAL.caption },
    },
    {
      id: "cert_issued",
      type: "field",
      field: "issuedOn",
      label: "Issued on 3 March 2099",
      x: 80,
      y: 560,
      w: 963,
      h: 24,
      style: { fontSize: 12, textAlign: "center", color: PRINT_NEUTRAL.caption },
    },
  ],
};

export interface WorkshopCertificateLabels {
  heading: string;
  statement: string;
  issuedLabel: string;
}

export function buildWorkshopCertificatePayload(
  row: Pick<WorkshopCompletionRow, "contactName" | "certificateIssuedAt" | "completedAt">,
  workshop: Pick<WorkshopEvent, "title" | "startDate" | "endDate">,
  labels: WorkshopCertificateLabels,
): WorkshopCertificatePayload {
  const issuedOn =
    row.certificateIssuedAt?.slice(0, 10) || row.completedAt?.slice(0, 10) || todayISO();
  return {
    heading: labels.heading,
    statement: labels.statement,
    recipientName: row.contactName,
    courseName: workshop.title,
    period: formatWorkshopDates(workshop),
    issuedLabel: labels.issuedLabel,
    issuedOn: formatDate(issuedOn),
  };
}
