import React, { type JSX, useMemo } from "react";
import { RotateCw, Scissors } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  CompactSegmentedControl,
  type CompactSegmentedOption,
} from "@/components/ui/CompactSegmentedControl";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export type StudentCardPrintMode = "front" | "back" | "both";

export interface StudentIdCardPrintControlsBarProps {
  printMode: StudentCardPrintMode;
  onSelectPrintMode: (mode: StudentCardPrintMode) => void;
  onToggleGlobalFlipped: () => void;
  showCutGuides: boolean;
  onToggleShowCutGuides: () => void;
  t: TranslationFunction;
}

export function StudentIdCardPrintControlsBar({
  printMode,
  onSelectPrintMode,
  onToggleGlobalFlipped,
  showCutGuides,
  onToggleShowCutGuides,
  t,
}: StudentIdCardPrintControlsBarProps): JSX.Element {
  const options = useMemo<readonly CompactSegmentedOption<StudentCardPrintMode>[]>(
    () => [
      { value: "front", label: t("students.idCard.printFrontOnly") },
      { value: "back", label: t("students.idCard.printBackOnly") },
      { value: "both", label: t("students.idCard.printBothSides") },
    ],
    [t],
  );

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border text-xs print:hidden">
      {/* Side Mode Selector */}
      <CompactSegmentedControl
        options={options}
        value={printMode}
        onChange={onSelectPrintMode}
        ariaLabel={t("students.idCard.print")}
      />

      {/* Quick Actions: Flip & Cut Guides */}
      <div className="flex items-center gap-1.5">
        {printMode !== "both" && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onToggleGlobalFlipped}
            className="flex items-center gap-1.5"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>{t("students.idCard.flipAll")}</span>
          </Button>
        )}

        <Button
          type="button"
          variant={showCutGuides ? "secondary" : "outline"}
          size="sm"
          onClick={onToggleShowCutGuides}
          className="flex items-center gap-1.5"
        >
          <Scissors className="w-3.5 h-3.5" />
          <span>{t("students.idCard.cutGuides")}</span>
        </Button>
      </div>
    </div>
  );
}
