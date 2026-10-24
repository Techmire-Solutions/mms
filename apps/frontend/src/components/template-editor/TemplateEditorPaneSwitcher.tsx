/**
 * @file TemplateEditorPaneSwitcher.tsx
 * @description Mobile pane switcher for the editor.
 *
 * Below `lg` the three panes used to stack vertically inside a fixed-height,
 * `overflow-hidden` column: 224px of element palette plus 256px of inspector against a
 * 320px-minimum canvas left the canvas clipped and the editor unusable on a phone.
 * They are tabs now, and only the selected pane is in flow.
 *
 * The host wraps each pane in a visibility div and marks it `lg:contents`. That is
 * load-bearing: at `lg` a real wrapper box would make the pane a column-flex item with
 * `shrink-0`, so it would take its *content* height instead of being stretched to the row
 * height, and the palette would overflow and be clipped with no internal scrolling.
 * `display: contents` removes the wrapper from the box tree and restores the original
 * stretch behaviour — as does `print:flex` on the canvas pane, because an inactive pane
 * is `hidden` below `lg` and print is not a screen size.
 */

import React, { useMemo } from "react";
import { SubTabBar } from "@/components/app/SubTabBar";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export type EditorPane = "elements" | "canvas" | "properties";

export interface TemplateEditorPaneSwitcherProps {
  value: EditorPane;
  onChange: (pane: EditorPane) => void;
  t: TranslationFunction;
}

export function TemplateEditorPaneSwitcher({
  value,
  onChange,
  t,
}: TemplateEditorPaneSwitcherProps): React.JSX.Element {
  const panes = useMemo(
    () => [
      { key: "elements" as const, label: t("templateEditor.tabElements") },
      { key: "canvas" as const, label: t("templateEditor.tabCanvas") },
      { key: "properties" as const, label: t("templateEditor.properties") },
    ],
    [t],
  );

  return (
    <div className="lg:hidden shrink-0 border-b border-border bg-card px-2 py-1.5 print:hidden">
      {/* Uses the shared SubTabBar: the repo bans bespoke sub-tab strips. */}
      <SubTabBar
        tabs={panes}
        value={value}
        onChange={onChange}
        variant="pill"
        resetScrollOnChange={false}
      />
    </div>
  );
}
