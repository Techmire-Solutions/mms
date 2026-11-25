import type { DocumentTemplatePreset } from "@mms/contracts";
import type { BrandingInfo } from "../host/invoiceTemplateStore";
import type { StudentCardPayload } from "./studentCardTemplateTypes";
import { getDefaultStudentCardTemplate } from "./studentCardTemplateDefaults";
import { getVerticalBadgeTemplate } from "./studentCardPresetBadge";
import { getMinimalTemplate } from "./studentCardPresetMinimal";

export interface StudentCardTemplatePreset extends DocumentTemplatePreset<StudentCardPayload> {
  nameKey: string;
}

export function getAvailableStudentCardPresets(
  branding?: BrandingInfo,
): StudentCardTemplatePreset[] {
  const madrasaName = branding?.madrasaName || "Madrasa Management System";
  const standardTemplate = getDefaultStudentCardTemplate(branding);
  const verticalBadgeTemplate = getVerticalBadgeTemplate(branding, madrasaName);
  const minimalTemplate = getMinimalTemplate(branding, madrasaName);

  return [
    {
      key: "standard",
      label: "Standard Card (Horizontal)",
      nameKey: "students.cardTemplate.presetStandard",
      template: standardTemplate,
    },
    {
      key: "badge",
      label: "Vertical Badge",
      nameKey: "students.cardTemplate.presetBadge",
      template: verticalBadgeTemplate,
    },
    {
      key: "minimal",
      label: "Modern Minimalist",
      nameKey: "students.cardTemplate.presetMinimal",
      template: minimalTemplate,
    },
  ];
}
