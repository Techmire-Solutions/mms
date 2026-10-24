import React from "react";
import {
  AlignCenterHorizontal,
  ArrowDownToLine,
  ArrowLeftToLine,
  ArrowRightToLine,
  ArrowUpToLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { TemplateEditorSection } from "./TemplateEditorSection";

export interface TemplateEditorMultiSelectCenterSnapProps {
  isOpen: boolean;
  onToggle: () => void;
  onCenterSelected?: (axis: "both" | "h" | "v") => void;
  onSnapSelected?: (edge: "top" | "bottom" | "left" | "right") => void;
  t: TranslationFunction;
}

export function TemplateEditorMultiSelectCenterSnap({
  isOpen,
  onToggle,
  onCenterSelected,
  onSnapSelected,
  t,
}: TemplateEditorMultiSelectCenterSnapProps): React.JSX.Element | null {
  if (!onCenterSelected && !onSnapSelected) return null;

  return (
    <TemplateEditorSection
      titleKey="templateEditor.centerOnPage"
      icon={AlignCenterHorizontal}
      isOpen={isOpen}
      onToggle={onToggle}
      t={t}
      panelClassName="space-y-2.5"
    >
      {onCenterSelected && (
        <div role="group" aria-label={t("templateEditor.centerOnPage")} className="space-y-1.5">
          <Button
            type="button"
            variant="outline"
            onClick={() => onCenterSelected("both")}
            className="w-full min-h-11 text-xs rounded-lg border-border hover:bg-muted flex items-center justify-center gap-1.5 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
            title={t("templateEditor.centerOnPage")}
            aria-label={t("templateEditor.centerOnPage")}
          >
            <AlignCenterHorizontal className="w-4 h-4" aria-hidden="true" />
            <span>{t("templateEditor.centerOnPage")}</span>
          </Button>
          <div className="grid grid-cols-2 gap-1.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => onCenterSelected("h")}
              className="min-h-11 text-xs rounded-lg border-border hover:bg-muted flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
              title={t("templateEditor.centerHorizontally")}
              aria-label={t("templateEditor.centerHorizontally")}
            >
              <span className="truncate">{t("templateEditor.centerHorizontally")}</span>
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => onCenterSelected("v")}
              className="min-h-11 text-xs rounded-lg border-border hover:bg-muted flex items-center justify-center focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
              title={t("templateEditor.centerVertically")}
              aria-label={t("templateEditor.centerVertically")}
            >
              <span className="truncate">{t("templateEditor.centerVertically")}</span>
            </Button>
          </div>
        </div>
      )}

      {onSnapSelected && (
        <div className="pt-2 border-t border-border space-y-1.5">
          <p className="text-xs font-bold uppercase text-muted-foreground tracking-widest m-0">
            {t("templateEditor.snapToEdge")}
          </p>
          <div
            role="group"
            aria-label={t("templateEditor.snapToEdge")}
            className="grid grid-cols-4 gap-1"
          >
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onSnapSelected("top")}
              className="min-h-11 w-full rounded-lg border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
              title={t("templateEditor.snapTop")}
              aria-label={t("templateEditor.snapTop")}
            >
              <ArrowUpToLine className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onSnapSelected("bottom")}
              className="min-h-11 w-full rounded-lg border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
              title={t("templateEditor.snapBottom")}
              aria-label={t("templateEditor.snapBottom")}
            >
              <ArrowDownToLine className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onSnapSelected("left")}
              className="min-h-11 w-full rounded-lg border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
              title={t("templateEditor.snapLeft")}
              aria-label={t("templateEditor.snapLeft")}
            >
              <ArrowLeftToLine className="w-4 h-4" aria-hidden="true" />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              onClick={() => onSnapSelected("right")}
              className="min-h-11 w-full rounded-lg border-border hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden"
              title={t("templateEditor.snapRight")}
              aria-label={t("templateEditor.snapRight")}
            >
              <ArrowRightToLine className="w-4 h-4" aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </TemplateEditorSection>
  );
}
