/**
 * @file TemplateEditorKeyboardHints.tsx
 * @description Sleek bottom footer displaying platform-aware keyboard shortcut hints in a compact single-line bar.
 */

import React, { useMemo } from "react";
import { Keyboard } from "lucide-react";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorKeyboardHintsProps {
  t: TranslationFunction;
}

export function TemplateEditorKeyboardHints({
  t,
}: TemplateEditorKeyboardHintsProps): React.JSX.Element {
  const isMac = useMemo(() => {
    if (typeof window === "undefined" || typeof navigator === "undefined") return false;
    const nav = navigator as Navigator & { userAgentData?: { platform?: string } };
    const platformData = nav.userAgentData?.platform;
    if (platformData) {
      return /Mac|iPhone|iPad|iPod/i.test(platformData);
    }
    return /Mac|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }, []);

  const mod = isMac ? "⌘" : "Ctrl+";
  const altKey = isMac ? "⌥" : "Alt+";
  const delKey = isMac ? "⌫" : "Del";

  const shortcuts: [string, string][] = [
    [`${mod}S`, t("templateEditor.save")],
    [`${mod}Z`, t("templateEditor.undo")],
    [isMac ? "⇧⌘Z" : "Ctrl+Y", t("templateEditor.redo")],
    [`${mod}A`, t("templateEditor.selectAll")],
    [`${mod}C / ${mod}X`, `${t("templateEditor.copy")} / ${t("templateEditor.cut")}`],
    [`${mod}V`, t("templateEditor.paste")],
    [`${mod}D`, t("templateEditor.duplicate")],
    [`${mod}+ / ${mod}-`, `${t("templateEditor.zoomIn")} / ${t("templateEditor.zoomOut")}`],
    ["Space+Drag", t("templateEditor.spaceToPan")],
    ["Arrows", t("templateEditor.nudgeHint")],
    [`${altKey}Arrows`, t("templateEditor.altResize")],
    [delKey, t("templateEditor.delete")],
    ["Esc", t("templateEditor.deselect")],
  ];

  return (
    <footer
      aria-label={t("templateEditor.shortcuts")}
      className="hidden sm:flex flex-shrink-0 h-7 border-t border-border/70 bg-card/95 backdrop-blur-xs px-3 items-center justify-between gap-3 select-none overflow-hidden print:hidden"
    >
      {/* The fade-out mask follows the writing direction, not the physical right edge. */}
      <div
        tabIndex={0}
        role="region"
        aria-label={t("templateEditor.shortcuts")}
        className="flex items-center gap-3 overflow-x-auto no-scrollbar py-0.5 w-full focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [mask-image:linear-gradient(to_right,black_calc(100%-24px),transparent)] rtl:[mask-image:linear-gradient(to_left,black_calc(100%-24px),transparent)]"
      >
        <div className="flex items-center gap-1.5 font-semibold text-muted-foreground shrink-0 text-3xs uppercase tracking-wider">
          <Keyboard className="w-3.5 h-3.5 text-primary/80" aria-hidden="true" />
          <span>{t("templateEditor.shortcuts")}:</span>
        </div>
        {/* eslint-disable-next-line jsx-a11y/no-redundant-roles -- role="list" restores list semantics Safari/VoiceOver drop under list-style:none */}
        <ul role="list" className="flex items-center gap-3 shrink-0 m-0 p-0 list-none">
          {shortcuts.map(([shortcutKey, shortcutLabel]) => (
            <li
              key={shortcutKey}
              className="text-muted-foreground flex items-center gap-1 whitespace-nowrap"
            >
              <kbd
                dir="ltr"
                className="px-1.5 py-0.5 rounded border border-border/80 bg-muted/60 text-foreground font-mono text-3xs font-medium shadow-2xs"
              >
                {shortcutKey}
              </kbd>
              <span className="text-3xs">{shortcutLabel}</span>
            </li>
          ))}
        </ul>
      </div>
    </footer>
  );
}
