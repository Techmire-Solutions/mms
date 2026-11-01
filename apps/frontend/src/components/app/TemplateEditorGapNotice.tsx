/**
 * @file TemplateEditorGapNotice.tsx
 * @description Inline notice for template editors whose saved layout is not yet
 * consumed by a printed document.
 *
 * Finance receipts, report cards and hasanat vouchers can be authored (and are stored
 * server-side), but their print paths still render fixed components. Until those
 * renderers read the layout, the Setup tab must say so instead of implying that a Save
 * changes the printed page. Remove the notice from a module as soon as its print path
 * consumes the template.
 */

import React from "react";
import { Info } from "lucide-react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorGapNoticeProps {
  t: TranslationFunction;
}

export function TemplateEditorGapNotice({ t }: TemplateEditorGapNoticeProps): React.JSX.Element {
  return (
    <div
      role="note"
      className="mb-3 flex items-start gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning"
    >
      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="m-0 leading-relaxed">{t("templateEditor.layoutNotRendered")}</p>
    </div>
  );
}

export default TemplateEditorGapNotice;
