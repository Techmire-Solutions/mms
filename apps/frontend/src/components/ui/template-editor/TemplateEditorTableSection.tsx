import React, { useId } from "react";
import { Plus, ChevronUp, ChevronDown, Trash2, Table as TableIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TemplateElement } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { TemplateEditorSection } from "./TemplateEditorSection";

export interface TemplateEditorTableSectionProps<TFieldKey extends string = string> {
  selectedElement: TemplateElement<TFieldKey>;
  isOpen: boolean;
  onToggle: () => void;
  onPatchElement: (elementId: string, patch: Partial<TemplateElement<TFieldKey>>) => void;
  t: TranslationFunction;
}

export function TemplateEditorTableSection<TFieldKey extends string = string>({
  selectedElement,
  isOpen,
  onToggle,
  onPatchElement,
  t,
}: TemplateEditorTableSectionProps<TFieldKey>): React.JSX.Element {
  const existingCols = selectedElement.columns || [];
  const baseId = useId();

  const addColumn = () => {
    const newCols = [
      ...existingCols,
      {
        id: crypto.randomUUID(),
        header: `${t("templateEditor.columnHeader")} ${existingCols.length + 1}`,
        field: `field_${existingCols.length + 1}`,
        width: 80,
        align: "left" as const,
      },
    ];
    onPatchElement(selectedElement.id, { columns: newCols });
  };

  const updateColumn = (cIdx: number, patch: Partial<(typeof existingCols)[number]>) => {
    const newCols = [...existingCols];
    const col = newCols[cIdx];
    if (!col) return;
    newCols[cIdx] = { ...col, ...patch };
    onPatchElement(selectedElement.id, { columns: newCols });
  };

  const moveColumn = (cIdx: number, direction: "up" | "down") => {
    const newCols = [...existingCols];
    const targetIdx = direction === "up" ? cIdx - 1 : cIdx + 1;
    if (targetIdx < 0 || targetIdx >= newCols.length) return;
    const temp = newCols[cIdx]!;
    newCols[cIdx] = newCols[targetIdx]!;
    newCols[targetIdx] = temp;
    onPatchElement(selectedElement.id, { columns: newCols });
  };

  const deleteColumn = (cIdx: number) => {
    const newCols = existingCols.filter((_, idx) => idx !== cIdx);
    onPatchElement(selectedElement.id, { columns: newCols });
  };

  return (
    <TemplateEditorSection
      titleKey="templateEditor.table"
      icon={TableIcon}
      isOpen={isOpen}
      onToggle={onToggle}
      t={t}
      panelClassName="space-y-2"
    >
      <Button
        type="button"
        variant="outline"
        onClick={addColumn}
        className="w-full min-h-11 h-11 px-3 text-xs flex items-center justify-center gap-1.5 rounded-lg border-border hover:bg-muted"
        title={t("templateEditor.addColumn")}
        aria-label={t("templateEditor.addColumn")}
      >
        <Plus className="w-4 h-4" aria-hidden="true" />
        <span>{t("templateEditor.addColumn")}</span>
      </Button>

      <div role="list" className="space-y-2">
        {existingCols.map((col, cIdx) => {
          const headerId = `${baseId}-header-${cIdx}`;
          const fieldId = `${baseId}-field-${cIdx}`;
          const widthId = `${baseId}-width-${cIdx}`;
          return (
            <div
              role="listitem"
              key={col.id ?? cIdx}
              className="p-2 rounded-lg border border-border/70 bg-muted/20 space-y-1.5"
            >
              <div className="space-y-1">
                <label
                  htmlFor={headerId}
                  className="text-3xs font-bold uppercase text-muted-foreground tracking-wide"
                >
                  {t("templateEditor.columnHeader")}
                </label>
                <Input
                  id={headerId}
                  type="text"
                  value={col.header}
                  placeholder={t("templateEditor.columnHeader")}
                  onChange={(e) => updateColumn(cIdx, { header: e.target.value })}
                  className="min-h-11 h-11 text-xs px-2 py-0.5"
                />
                <label
                  htmlFor={fieldId}
                  className="text-3xs font-bold uppercase text-muted-foreground tracking-wide"
                >
                  {t("templateEditor.columnField")}
                </label>
                <Input
                  id={fieldId}
                  type="text"
                  value={col.field}
                  placeholder={t("templateEditor.columnField")}
                  onChange={(e) => updateColumn(cIdx, { field: e.target.value })}
                  className="min-h-11 h-11 text-xs px-2 py-0.5 font-mono"
                />
              </div>

              <div className="flex flex-wrap items-end gap-1 pt-1 border-t border-border/40">
                <div className="flex-1 min-w-18 space-y-1">
                  <label
                    htmlFor={widthId}
                    className="text-3xs font-bold uppercase text-muted-foreground tracking-wide"
                  >
                    {t("templateEditor.width")}
                  </label>
                  <Input
                    id={widthId}
                    type="text"
                    inputMode="numeric"
                    min={20}
                    max={400}
                    value={col.width ?? 80}
                    onChange={(e) => {
                      const w = Number(e.target.value);
                      if (!Number.isNaN(w)) {
                        updateColumn(cIdx, { width: Math.max(20, w) });
                      }
                    }}
                    className="min-h-11 h-11 text-xs px-1.5 py-0 font-mono"
                  />
                </div>

                <div
                  role="group"
                  aria-label={`${col.header || t("templateEditor.columnHeader")} ${cIdx + 1}`}
                  className="flex items-center gap-0.5"
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={cIdx === 0}
                    onClick={() => moveColumn(cIdx, "up")}
                    className="min-h-11 min-w-11 h-11 w-11 text-muted-foreground hover:text-foreground rounded disabled:opacity-30"
                    title={t("templateEditor.moveColumnBackward")}
                    aria-label={t("templateEditor.moveColumnBackward")}
                  >
                    <ChevronUp className="w-4 h-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    disabled={cIdx === existingCols.length - 1}
                    onClick={() => moveColumn(cIdx, "down")}
                    className="min-h-11 min-w-11 h-11 w-11 text-muted-foreground hover:text-foreground rounded disabled:opacity-30"
                    title={t("templateEditor.moveColumnForward")}
                    aria-label={t("templateEditor.moveColumnForward")}
                  >
                    <ChevronDown className="w-4 h-4" aria-hidden="true" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => deleteColumn(cIdx)}
                    className="min-h-11 min-w-11 h-11 w-11 text-destructive hover:bg-destructive/10 rounded"
                    title={t("templateEditor.deleteColumn")}
                    aria-label={t("templateEditor.deleteColumn")}
                  >
                    <Trash2 className="w-4 h-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </TemplateEditorSection>
  );
}
