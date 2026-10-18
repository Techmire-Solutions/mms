import React from "react";

export interface TypographySwatchItem {
  label: string;
  color: string;
}

export interface TemplateEditorTypographySwatchesProps {
  swatches: TypographySwatchItem[];
  allSameColor: boolean;
  effectiveColor?: string;
  onSelectColor: (color: string) => void;
  paletteLabel: string;
}

export function TemplateEditorTypographySwatches({
  swatches,
  allSameColor,
  effectiveColor,
  onSelectColor,
  paletteLabel,
}: TemplateEditorTypographySwatchesProps): React.JSX.Element {
  return (
    <div className="space-y-1.5">
      <span className="text-3xs text-muted-foreground font-semibold">{paletteLabel}:</span>
      <div className="flex items-center gap-0.5 flex-wrap">
        {swatches.map((swatch) => {
          const isSelected = allSameColor && effectiveColor === swatch.color.toLowerCase();
          return (
            <button
              key={swatch.color}
              type="button"
              title={swatch.label}
              aria-label={swatch.label}
              aria-pressed={isSelected}
              onClick={() => onSelectColor(swatch.color)}
              className="min-h-11 min-w-11 flex items-center justify-center p-1 rounded-lg hover:bg-muted/40 cursor-pointer focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-hidden"
            >
              <span
                style={{ backgroundColor: swatch.color }}
                className={`w-6 h-6 rounded-full border transition-all shadow-xs ${
                  isSelected
                    ? "ring-2 ring-primary ring-offset-2 ring-offset-background scale-110 border-transparent"
                    : "border-border/80 hover:scale-110"
                }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
