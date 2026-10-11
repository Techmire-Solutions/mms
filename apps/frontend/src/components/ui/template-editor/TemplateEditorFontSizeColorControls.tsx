import React, { useState } from "react";
import { Minus, Plus } from "lucide-react";
import { PRINT_NEUTRAL } from "@/lib/printBrandingTokens";
import type { ElementStyle } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { normalizeHexColor } from "./templateEditorUtils";

export interface TemplateEditorFontSizeColorControlsProps {
  fontSizeId: string;
  fontColorId: string;
  currentFontSize: number;
  color?: string;
  onPatchStyle: (stylePatch: Partial<ElementStyle>) => void;
  t: TranslationFunction;
}

export function TemplateEditorFontSizeColorControls({
  fontSizeId,
  fontColorId,
  currentFontSize,
  color,
  onPatchStyle,
  t,
}: TemplateEditorFontSizeColorControlsProps): React.JSX.Element {
  const [fontSizeDraft, setFontSizeDraft] = useState<string | null>(null);
  const displayFontSize = fontSizeDraft ?? String(currentFontSize);

  const handleFontSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setFontSizeDraft(val);
    const num = Number(val);
    if (!Number.isNaN(num) && num >= 6 && num <= 72) {
      onPatchStyle({ fontSize: num });
    }
  };

  const handleFontSizeBlur = () => {
    if (fontSizeDraft !== null) {
      const num = Number(fontSizeDraft);
      if (!Number.isNaN(num) && num > 0) {
        onPatchStyle({ fontSize: Math.max(6, Math.min(72, num)) });
      }
      setFontSizeDraft(null);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={fontSizeId}
          className="text-xs font-bold uppercase text-muted-foreground tracking-wide"
        >
          {t("templateEditor.fontSize")}
        </label>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setFontSizeDraft(null);
              onPatchStyle({ fontSize: Math.max(6, currentFontSize - 1) });
            }}
            disabled={currentFontSize <= 6}
            title={t("templateEditor.decreaseFontSize")}
            aria-label={t("templateEditor.decreaseFontSize")}
            className="min-h-11 min-w-8 h-11 px-2 border border-border rounded-lg bg-background hover:bg-muted text-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <Minus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
          <input
            id={fontSizeId}
            name={fontSizeId}
            aria-label={t("templateEditor.fontSize")}
            type="text"
            inputMode="numeric"
            min={6}
            max={72}
            value={displayFontSize}
            onChange={handleFontSizeChange}
            onBlur={handleFontSizeBlur}
            className="w-full min-h-11 h-11 p-1 text-center border border-border rounded-lg bg-background text-xs [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          />
          <button
            type="button"
            onClick={() => {
              setFontSizeDraft(null);
              onPatchStyle({ fontSize: Math.min(72, currentFontSize + 1) });
            }}
            disabled={currentFontSize >= 72}
            title={t("templateEditor.increaseFontSize")}
            aria-label={t("templateEditor.increaseFontSize")}
            className="min-h-11 min-w-8 h-11 px-2 border border-border rounded-lg bg-background hover:bg-muted text-foreground flex items-center justify-center disabled:opacity-40 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-hidden"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-0.5">
        <label
          htmlFor={fontColorId}
          className="text-xs font-bold uppercase text-muted-foreground tracking-wide"
        >
          {t("templateEditor.color")}
        </label>
        <input
          id={fontColorId}
          name={fontColorId}
          aria-label={t("templateEditor.color")}
          type="color"
          value={normalizeHexColor(color, PRINT_NEUTRAL.text)}
          onChange={(e) => onPatchStyle({ color: e.target.value })}
          className="w-full min-h-11 h-11 p-1 border border-border rounded-lg bg-background cursor-pointer"
        />
      </div>
    </div>
  );
}
