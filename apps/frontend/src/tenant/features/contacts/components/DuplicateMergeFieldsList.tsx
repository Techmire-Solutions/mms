import React from "react";
import { Check } from "lucide-react";
import type { Contact } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getDuplicateFieldLabel, getDuplicateFieldValue } from "@/lib/contacts/contactI18n";
import type { getDuplicateThemeColors } from "@/tenant/features/contacts/lib/duplicateDetectionTypes";

export interface DuplicateMergeFieldsListProps {
  fields: string[];
  keep: Contact;
  other: Contact;
  customMerged: Contact;
  emptyDash: string;
  fieldOverrides: Record<string, number>;
  setFieldOverrides: React.Dispatch<React.SetStateAction<Record<string, number>>>;
  colors: ReturnType<typeof getDuplicateThemeColors>;
  t: TranslationFunction;
}

export function DuplicateMergeFieldsList({
  fields,
  keep,
  other,
  customMerged,
  emptyDash,
  fieldOverrides,
  setFieldOverrides,
  colors,
  t,
}: DuplicateMergeFieldsListProps): React.JSX.Element {
  return (
    <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3 text-foreground">
      {fields.map((field) => {
        const keepValue = getDuplicateFieldValue(field, keep, t);
        const otherValue = getDuplicateFieldValue(field, other, t);
        const mergedValue = getDuplicateFieldValue(field, customMerged, t);

        const hasConflict =
          keepValue &&
          otherValue &&
          keepValue !== emptyDash &&
          otherValue !== emptyDash &&
          keepValue !== otherValue;

        const fromOther =
          (!keepValue || keepValue === emptyDash || keepValue === "") &&
          otherValue &&
          otherValue !== emptyDash &&
          otherValue !== "";

        const selectedIndex = fieldOverrides[field] ?? 0;

        return (
          <div key={field} className="rounded-lg border border-border/50 bg-background/50 p-2.5">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <span className="w-24 shrink-0 text-xs font-medium text-muted-foreground">
                {getDuplicateFieldLabel(field, t)}:
              </span>
              <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
                {mergedValue || emptyDash}
              </span>
              {fromOther && (
                <Badge
                  pill
                  variant="outline"
                  className={`px-1.5 font-medium ${colors.highlightBg}`}
                >
                  {t("contacts.duplicates.fromDuplicate")}
                </Badge>
              )}
            </div>

            {hasConflict && (
              <div className="mt-2 flex flex-wrap items-center gap-2 pt-2 border-t border-border/40 text-xs">
                <span className="text-muted-foreground text-xs font-semibold">
                  {t("contacts.duplicates.selectField")}
                </span>
                <Button
                  type="button"
                  variant={selectedIndex === 0 ? "default" : "secondary"}
                  size="sm"
                  aria-pressed={selectedIndex === 0}
                  onClick={() => setFieldOverrides((prev) => ({ ...prev, [field]: 0 }))}
                  className="min-h-11 rounded-lg px-3 py-2 text-xs gap-1.5 shadow-none"
                >
                  {selectedIndex === 0 && <Check className="w-3.5 h-3.5" />}
                  <span>
                    {t("contacts.duplicates.fieldFromA")}: {keepValue}
                  </span>
                </Button>
                <Button
                  type="button"
                  variant={selectedIndex === 1 ? "default" : "secondary"}
                  size="sm"
                  aria-pressed={selectedIndex === 1}
                  onClick={() => setFieldOverrides((prev) => ({ ...prev, [field]: 1 }))}
                  className="min-h-11 rounded-lg px-3 py-2 text-xs gap-1.5 shadow-none"
                >
                  {selectedIndex === 1 && <Check className="w-3.5 h-3.5" />}
                  <span>
                    {t("contacts.duplicates.fieldFromB")}: {otherValue}
                  </span>
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
