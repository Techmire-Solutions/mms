import React from "react";
import type { ElementStyle, TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateImageElementContentProps {
  el: TemplateElement;
  data?: Record<string, unknown> | null;
  st: ElementStyle;
  logoUrl?: string | null;
  logoFailed?: boolean;
  hideMissingLogo?: boolean;
  onLogoError?: () => void;
  t: TranslationFunction;
}

export function TemplateImageElementContent({
  el,
  data,
  st,
  logoUrl,
  logoFailed = false,
  hideMissingLogo = false,
  onLogoError,
  t,
}: TemplateImageElementContentProps): React.JSX.Element | null {
  const isPhotoTarget =
    el.field === "photo" ||
    el.field === "student_photo" ||
    el.field === "avatar" ||
    el.id === "student_photo" ||
    el.type === "avatar" ||
    el.type === "photo";

  if (isPhotoTarget) {
    const photoVal =
      (data?.photo as string) || (data?.student_photo as string) || (data?.avatar as string);

    if (
      photoVal &&
      typeof photoVal === "string" &&
      (photoVal.startsWith("http") || photoVal.startsWith("data:") || photoVal.startsWith("/"))
    ) {
      return (
        <img
          src={photoVal}
          alt={t("students.cardTemplate.field.photo")}
          className="w-full h-full object-cover pointer-events-none"
          style={{ borderRadius: st.borderRadius != null ? `${st.borderRadius}px` : undefined }}
        />
      );
    }

    return (
      <div
        className="w-full h-full flex flex-col items-center justify-center bg-muted/60 text-muted-foreground select-none pointer-events-none"
        style={{ borderRadius: st.borderRadius != null ? `${st.borderRadius}px` : undefined }}
      >
        <svg
          className="w-1/2 h-1/2 opacity-60"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
          <circle cx="12" cy="7" r="4" />
        </svg>
        <span className="text-4xs font-semibold uppercase tracking-wider mt-0.5 opacity-75">
          {t("students.cardTemplate.field.photo")}
        </span>
      </div>
    );
  }

  if (logoUrl && !logoFailed) {
    return (
      <img
        src={logoUrl}
        alt={t("templateEditor.logo")}
        onError={onLogoError}
        className="w-full h-full object-contain pointer-events-none"
      />
    );
  }
  if (hideMissingLogo) return null;
  return (
    <div className="w-full h-full border border-dashed border-border flex items-center justify-center text-2xs text-muted-foreground font-medium">
      {t("templateEditor.logoPlaceholder")}
    </div>
  );
}
