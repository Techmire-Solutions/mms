import React from "react";

export interface ModuleTableFooterCountProps {
  /** Number of rows currently selected in the Work table. */
  selectedCount: number;
  /** Localized selection label (translated by the module, e.g. `t('faculty.selectedCount')`). */
  selectedCountLabel: string;
  /** Localized page count label, e.g. `"24 faculty"`. */
  pageCountLabel: string;
}

/**
 * Work table footer count bar shared by Contacts, Students, and Faculty.
 * Shows the selected-count + page-count combo, or just the page count when nothing is selected.
 */
export const ModuleTableFooterCount = function ModuleTableFooterCount({
  selectedCount,
  selectedCountLabel,
  pageCountLabel,
}: ModuleTableFooterCountProps): React.JSX.Element {
  return (
    <div className="px-4 py-3 border-t border-border/50 flex items-center justify-between bg-muted/5">
      <p className="text-xs text-muted-foreground">
        {selectedCount > 0 ? (
          <>
            <span>{selectedCountLabel}</span>
            <span className="mx-1.5 text-border" aria-hidden="true">
              ·
            </span>
            <span>{pageCountLabel}</span>
          </>
        ) : (
          pageCountLabel
        )}
      </p>
    </div>
  );
};
