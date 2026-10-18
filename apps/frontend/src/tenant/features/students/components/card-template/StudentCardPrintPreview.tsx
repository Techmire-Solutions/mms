/**
 * @file StudentCardPrintPreview.tsx
 * @description Renders a single student ID card using the customizable template and TemplateElementContent.
 */

import React, { useMemo } from "react";
import { formatBrandingAddress, formatDate, getPageDimensions, type Student } from "@mms/shared";
import { useBranding } from "@/tenant/hooks/useBranding";
import { useTranslation } from "@/hooks/useTranslation";
import { getPrintBrandingTokens } from "@/lib/ui/printBrandingTokens";
import { TemplateElementContent } from "@/components/template-editor/templateElementContent";
import { resolveElementGeometry } from "@/components/template-editor/templateDataResolution";
import { interpolateTemplateTokens } from "@/components/template-editor/templateEditorUtils";
import type {
  CardSide,
  StudentCardPayload,
  StudentCardTemplate,
} from "../../lib/studentCardTemplateTypes";

export interface StudentCardPrintPreviewProps {
  template: StudentCardTemplate;
  student: Student;
  side?: CardSide;
  sessionNames?: string[];
  guardianName?: string;
  emergencyPhone?: string;
  bloodGroup?: string;
  madrasaName?: string;
  className?: string;
}

export function StudentCardPrintPreview({
  template,
  student,
  side = "front",
  sessionNames = [],
  guardianName,
  emergencyPhone,
  bloodGroup,
  madrasaName = "Madrasa Management System",
  className = "",
}: StudentCardPrintPreviewProps): React.JSX.Element {
  const branding = useBranding();
  const { t, isRtl } = useTranslation();
  const printTokens = getPrintBrandingTokens();
  const size = getPageDimensions(template.pageSize || "CR80", template.orientation || "landscape");
  const appDir = isRtl ? "rtl" : "ltr";

  const elementsToRender = useMemo(() => {
    if (side === "back") {
      return template.backElements && template.backElements.length > 0 ? template.backElements : [];
    }
    return template.elements || [];
  }, [side, template.elements, template.backElements]);

  const data = useMemo<Record<string, unknown>>(() => {
    const studentWithExtras = student as {
      avatarUrl?: string;
      photo?: string;
      cnic?: string;
      identificationNumber?: string;
    };
    const institutionAddress = formatBrandingAddress(branding) || "Seminary Road";
    const oneYearLater = new Date();
    oneYearLater.setFullYear(oneYearLater.getFullYear() + 1);

    const payload: StudentCardPayload = {
      student_name: student.name || "—",
      gr_number: student.grNumber || "—",
      student_id: String(student.studentId || student.id || "—"),
      roll_number: "—",
      session_name: sessionNames.length > 0 ? sessionNames.join(", ") : "—",
      guardian_name: guardianName || student.fatherName || "—",
      emergency_phone: emergencyPhone || student.phone || "—",
      phone: student.phone || "—",
      email: student.email || "—",
      blood_group: bloodGroup || "—",
      dob: student.dob || "—",
      gender: student.gender || "—",
      city: student.city || "—",
      national_id: studentWithExtras.cnic || studentWithExtras.identificationNumber || "—",
      photo: studentWithExtras.avatarUrl || studentWithExtras.photo || "",
      card_terms: t("students.idCard.termsDefault"),
      authorized_signature: t("students.idCard.principalSign"),
      expiry_date: formatDate(oneYearLater),
      institution_name: madrasaName || branding.madrasaName || "Madrasa",
      institution_phone: branding.phone || "—",
      institution_email: branding.email || "—",
      institution_address: institutionAddress,
      issue_date: formatDate(new Date()),
    };
    return payload;
  }, [student, sessionNames, guardianName, emergencyPhone, bloodGroup, madrasaName, branding, t]);

  const qrPayload = useMemo(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/verify/student?id=${encodeURIComponent(String(student.id))}&gr=${encodeURIComponent(student.grNumber || "")}`;
  }, [student.id, student.grNumber]);

  return (
    <div
      style={{
        position: "relative",
        width: size.width,
        minHeight: size.height,
        background: printTokens.paper,
      }}
      className={`id-card-preview relative border border-border/80 rounded-xl shadow-sm overflow-hidden break-inside-avoid print:break-inside-avoid print:shadow-none print:border-black/30 print:bg-white ${className}`}
    >
      {elementsToRender.map((templateElement) => {
        const elementStyle = templateElement.style || {};
        const rawFieldValue = templateElement.field ? data[templateElement.field] : undefined;
        const geometry = resolveElementGeometry(
          templateElement,
          appDir,
          typeof rawFieldValue === "string" ? rawFieldValue : undefined,
        );

        return (
          <div
            key={templateElement.id}
            dir={geometry.direction}
            style={{
              position: "absolute",
              left: templateElement.x,
              top: templateElement.y,
              width: templateElement.w,
              height: templateElement.h,
              boxSizing: "border-box",
              fontSize: elementStyle.fontSize || 9,
              fontWeight: elementStyle.fontWeight || "normal",
              fontFamily: elementStyle.fontFamily || "inherit",
              fontStyle: elementStyle.fontStyle || "normal",
              textAlign: geometry.textAlign,
              direction: geometry.direction,
              color: elementStyle.color || printTokens.text,
              backgroundColor: elementStyle.backgroundColor || "transparent",
              border: elementStyle.borderWidth
                ? `${elementStyle.borderWidth}px solid ${elementStyle.borderColor || printTokens.border}`
                : "none",
              borderRadius:
                elementStyle.borderRadius != null ? `${elementStyle.borderRadius}px` : undefined,
              overflow: "hidden",
            }}
          >
            <TemplateElementContent
              el={templateElement}
              data={data}
              mode="print"
              logoUrl={branding.logoUrl}
              qrPayload={qrPayload}
              hideMissingLogo={false}
              geometry={geometry}
              interpolate={interpolateTemplateTokens}
              t={t}
            />
          </div>
        );
      })}
    </div>
  );
}

export default StudentCardPrintPreview;
