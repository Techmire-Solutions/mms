/**
 * @file TemplateEditorPrintRules.tsx
 * @description Emits the `@page` rule that gives the editing surface the template's own
 * paper size when the toolbar's Print button is used.
 */

import React from "react";
import type { TemplateOrientation } from "@mms/shared";

export interface TemplateEditorPrintRulesProps {
  width: number;
  height: number;
  orientation: TemplateOrientation;
}

/**
 * The toolbar's Print button used to call `window.print()` with no `@page` rule, so an
 * A6 receipt printed at the browser's default paper size and long documents came out
 * clipped. Sizes are the template's own CSS pixels at 96dpi, and the orientation comes
 * from the template rather than the printer default.
 */
export function TemplateEditorPrintRules({
  width,
  height,
  orientation,
}: TemplateEditorPrintRulesProps): React.JSX.Element {
  return (
    <style>{`@media print { @page { size: ${width}px ${height}px ${orientation}; margin: 0; } }`}</style>
  );
}
