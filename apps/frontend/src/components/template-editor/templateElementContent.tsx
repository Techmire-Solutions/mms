/**
 * @file templateElementContent.tsx
 * @description Single source of truth for how a template element's *content* is
 * rendered, shared by the editor canvas and the print/PDF renderer. Data resolution
 * lives in `templateDataResolution.ts`.
 */

import React from "react";
import { generateQrSvgUri } from "@/lib/qrCodeGenerator";
import { PRINT_NEUTRAL } from "@/lib/ui/printBrandingTokens";
import type { ElementStyle, TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import {
  resolveElementText,
  resolveQrPayload,
  type ElementGeometry,
  type TemplateRenderMode,
} from "./templateDataResolution";
import { TemplateTableElementContent } from "./TemplateTableElementContent";
import { TemplateImageElementContent } from "./TemplateImageElementContent";

export * from "./templateDataResolution";

export interface TemplateElementContentProps {
  el: TemplateElement;
  data?: Record<string, unknown> | null;
  mode: TemplateRenderMode;
  logoUrl?: string | null;
  geometry: ElementGeometry;
  onLogoError?: () => void;
  hideMissingLogo?: boolean;
  qrPayload?: string | null;
  logoFailed?: boolean;
  interpolate: (text: string, data: Record<string, unknown>) => string;
  t: TranslationFunction;
}

export function TemplateElementContent({
  el,
  data,
  mode,
  logoUrl,
  geometry,
  hideMissingLogo = false,
  qrPayload = null,
  logoFailed = false,
  onLogoError,
  interpolate,
  t,
}: TemplateElementContentProps): React.JSX.Element | null {
  const st = (el.style || {}) as ElementStyle;
  const tableFontSize = st.fontSize ? Math.max(7, st.fontSize - 2) : 9;
  const defaultColAlign = geometry.direction === "rtl" ? "right" : "left";

  if (el.type === "divider") {
    return (
      <hr
        style={{
          borderColor: st.borderColor || st.color || PRINT_NEUTRAL.border,
          borderTopWidth: st.borderWidth != null ? `${st.borderWidth}px` : "1px",
        }}
        className="w-full border-0 border-t m-0"
      />
    );
  }

  if (el.type === "qrcode") {
    const payload = resolveQrPayload(el, data, {
      explicitPayload: qrPayload,
      qrCodeLabel: t("templateEditor.qrCode"),
      // Never fall back to the logo URL: an unbound QR used to encode a brand asset
      // (or a data URI), which is not a document payload and produces an unusable code.
      placeholder: "MMS-DOC",
    });
    return (
      <img
        src={generateQrSvgUri(payload, st.color)}
        alt={t("templateEditor.qrCode")}
        className="w-full h-full object-contain pointer-events-none"
      />
    );
  }

  if (el.type === "logo" || el.type === "avatar" || el.type === "photo" || el.type === "image") {
    return (
      <TemplateImageElementContent
        el={el}
        data={data}
        st={st}
        logoUrl={logoUrl}
        logoFailed={logoFailed}
        hideMissingLogo={hideMissingLogo}
        onLogoError={onLogoError}
        t={t}
      />
    );
  }

  if (el.type === "table") {
    return (
      <TemplateTableElementContent
        el={el}
        data={data}
        mode={mode}
        defaultColAlign={defaultColAlign}
        tableFontSize={tableFontSize}
      />
    );
  }

  // static / field text
  const content = resolveElementText(el, data, mode, interpolate);
  const isEmptyBoundField = el.type === "field" && content === "";
  if (isEmptyBoundField && mode === "edit") {
    return <span className="w-full truncate italic text-muted-foreground">{`{${el.field}}`}</span>;
  }
  if (isEmptyBoundField) {
    return <span className="w-full truncate">—</span>;
  }

  return <span className="w-full break-words whitespace-pre-wrap leading-tight">{content}</span>;
}
