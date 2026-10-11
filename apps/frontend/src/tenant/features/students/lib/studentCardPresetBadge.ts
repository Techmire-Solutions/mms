import type { BrandingInfo } from "@/lib/invoiceTemplateStore";
import { getVerticalBadgeBackElements } from "./studentCardPresetBadgeBack";
import type { StudentCardTemplate } from "./studentCardTemplateTypes";

export { getVerticalBadgeBackElements };

/**
 * Returns the vertical badge ID card preset (CR80 portrait lanyard format).
 */
export function getVerticalBadgeTemplate(
  branding?: BrandingInfo,
  madrasaName = "Madrasa Management System",
): StudentCardTemplate {
  return {
    pageSize: "CR80",
    orientation: "portrait",
    elements: [
      {
        id: "badge_inst",
        type: "field",
        field: "institution_name",
        label: madrasaName,
        x: 12,
        y: 10,
        w: 180,
        h: 16,
        style: { fontSize: 10, fontWeight: "bold", textAlign: "center", color: "rgb(15, 23, 42)" },
      },
      {
        id: "badge_title",
        type: "text",
        label: "STUDENT ID",
        x: 12,
        y: 28,
        w: 180,
        h: 12,
        style: { fontSize: 7, fontWeight: "bold", textAlign: "center", color: "rgb(2, 132, 199)" },
      },
      {
        id: "badge_div1",
        type: "divider",
        label: "Divider",
        x: 12,
        y: 42,
        w: 180,
        h: 1,
        style: { borderColor: "rgb(203, 213, 225)", borderWidth: 1 },
      },
      {
        id: "badge_photo",
        type: "logo",
        field: "photo",
        label: "Photo",
        x: 62,
        y: 48,
        w: 80,
        h: 90,
        style: {
          borderWidth: 1,
          borderColor: "rgb(203, 213, 225)",
          borderRadius: 8,
          backgroundColor: "rgb(248, 250, 252)",
        },
      },
      {
        id: "badge_name",
        type: "field",
        field: "student_name",
        label: "Student Name",
        x: 12,
        y: 144,
        w: 180,
        h: 16,
        style: { fontSize: 11, fontWeight: "bold", textAlign: "center", color: "rgb(15, 23, 42)" },
      },
      {
        id: "badge_gr",
        type: "field",
        field: "gr_number",
        label: "G.R. Number",
        x: 12,
        y: 162,
        w: 180,
        h: 13,
        style: { fontSize: 8, fontWeight: "bold", textAlign: "center", color: "rgb(2, 132, 199)" },
      },
      {
        id: "badge_session",
        type: "field",
        field: "session_name",
        label: "Session",
        x: 12,
        y: 176,
        w: 180,
        h: 13,
        style: { fontSize: 8, textAlign: "center", color: "rgb(71, 85, 105)" },
      },
      {
        id: "badge_qr",
        type: "qrcode",
        label: "QR Code",
        x: 72,
        y: 194,
        w: 60,
        h: 60,
        style: { color: "rgb(15, 23, 42)" },
      },
      {
        id: "badge_blood",
        type: "field",
        field: "blood_group",
        label: "Blood Group",
        x: 12,
        y: 260,
        w: 180,
        h: 12,
        style: { fontSize: 7, fontWeight: "bold", textAlign: "center", color: "rgb(220, 38, 38)" },
      },
      {
        id: "badge_issue",
        type: "field",
        field: "issue_date",
        label: "Issue Date",
        x: 12,
        y: 280,
        w: 180,
        h: 11,
        style: { fontSize: 6, textAlign: "center", color: "rgb(148, 163, 184)" },
      },
    ],
    backElements: getVerticalBadgeBackElements(madrasaName),
  };
}
