import React, { useMemo, useState } from "react";
import {
  Minus,
  QrCode,
  Type,
  Search,
  Database,
  Plus,
  Heading1,
  Image as ImageIcon,
  Table,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { AppTranslationKey, TemplateFieldDefinition } from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface TemplateEditorElementPaletteProps<TPayload = Record<string, unknown>> {
  availableFields?: TemplateFieldDefinition<TPayload>[];
  onAddStaticText: () => void;
  onAddHeading?: () => void;
  onAddDivider: () => void;
  onAddQrCode: () => void;
  onAddLogo?: () => void;
  onAddTable?: () => void;
  onAddField: (fieldOption: TemplateFieldDefinition<TPayload>) => void;
  t: TranslationFunction;
}

/**
 * One consistent treatment for every "add" affordance.
 *
 * These used to carry six different raw Tailwind accent colours (indigo, sky,
 * slate, emerald, amber, teal) with two more inside the icon chip, which is both a
 * design-token violation and visual noise: colour conveyed nothing, so six hues
 * read as six different kinds of action. Primitives are now neutral and
 * data-driven fields carry the single primary accent, which is the only
 * distinction that means anything here.
 */
/**
 * Show the field search box once the field list reaches this count.
 * At 6+ entries the palette is tall enough to benefit from filtering.
 */
const FIELD_SEARCH_THRESHOLD = 6;

const PRIMITIVE_BUTTON =
  "w-full text-start min-h-11 px-3 py-2 text-xs font-semibold rounded-lg border border-border border-s-[--palette-stripe-width] border-s-muted-foreground/40 bg-card hover:bg-muted/50 hover:border-s-muted-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden transition-colors flex items-center justify-between group shadow-2xs";

const PRIMITIVE_ICON =
  "p-1 rounded bg-muted text-muted-foreground group-hover:bg-foreground group-hover:text-background transition-colors";

const FIELD_BUTTON =
  "w-full text-start min-h-11 px-2.5 py-1.5 text-xs font-medium rounded-lg border border-border border-s-[--palette-stripe-width] border-s-primary/40 bg-card hover:bg-primary/5 hover:border-primary/50 hover:border-s-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:outline-hidden transition-colors flex items-center justify-between group shadow-2xs";

export function TemplateEditorElementPalette<TPayload = Record<string, unknown>>({
  availableFields = [],
  onAddStaticText,
  onAddHeading,
  onAddDivider,
  onAddQrCode,
  onAddLogo,
  onAddTable,
  onAddField,
  t,
}: TemplateEditorElementPaletteProps<TPayload>): React.JSX.Element {
  const [searchQuery, setSearchQuery] = useState("");

  const filteredFields = useMemo(
    () =>
      availableFields.filter(
        (f) =>
          f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          String(f.field).toLowerCase().includes(searchQuery.toLowerCase()),
      ),
    [availableFields, searchQuery],
  );

  const primitive = (
    labelKey: AppTranslationKey,
    Icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>,
    onClick: () => void,
  ) => (
    <Button type="button" onClick={onClick} variant="outline" className={PRIMITIVE_BUTTON}>
      <div className="flex items-center gap-2">
        <div className={PRIMITIVE_ICON}>
          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
        </div>
        <span>{t(labelKey)}</span>
      </div>
      <Plus
        className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground"
        aria-hidden="true"
      />
    </Button>
  );

  return (
    <aside
      aria-label={t("templateEditor.addElements")}
      className="max-h-56 w-full shrink-0 space-y-4 overflow-y-auto border-b border-border bg-card p-3 lg:max-h-none lg:w-56 lg:border-b-0 lg:border-e select-none print:hidden"
    >
      <div>
        <div className="flex items-center justify-between pb-1.5 mb-2.5 border-b border-border/70">
          <p className="text-xs font-bold uppercase text-foreground tracking-wider m-0 flex items-center gap-1.5">
            <Plus className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
            <span>{t("templateEditor.addElements")}</span>
          </p>
          <span className="text-3xs font-semibold px-2 py-0.5 rounded-full bg-muted text-muted-foreground uppercase tracking-wider">
            {t("templateEditor.primitives")}
          </span>
        </div>
        <div className="space-y-1.5">
          {onAddHeading && primitive("templateEditor.heading", Heading1, onAddHeading)}
          {primitive("templateEditor.staticText", Type, onAddStaticText)}
          {primitive("templateEditor.divider", Minus, onAddDivider)}
          {primitive("templateEditor.qrCode", QrCode, onAddQrCode)}
          {onAddLogo && primitive("templateEditor.logo", ImageIcon, onAddLogo)}
          {onAddTable && primitive("templateEditor.table", Table, onAddTable)}
        </div>
      </div>

      {availableFields.length > 0 && (
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between pb-1.5 border-b border-border/70">
            <p className="text-xs font-bold uppercase text-foreground tracking-wider m-0 flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-primary" aria-hidden="true" />
              <span>{t("templateEditor.addFields")}</span>
            </p>
            <span className="text-3xs bg-primary/10 text-primary font-bold px-2 py-0.5 rounded-full">
              {searchQuery
                ? `${filteredFields.length} / ${availableFields.length}`
                : availableFields.length}
            </span>
          </div>

          {availableFields.length >= FIELD_SEARCH_THRESHOLD && (
            <div className="relative">
              <Search
                className="w-3.5 h-3.5 text-muted-foreground absolute start-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
                aria-hidden="true"
              />
              <Input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Escape") setSearchQuery("");
                }}
                placeholder={t("templateEditor.filterFieldsPlaceholder")}
                aria-label={t("templateEditor.filterFieldsPlaceholder")}
                className="w-full ps-8 pe-7 py-1 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary min-h-11"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  aria-label={t("templateEditor.clearFilter")}
                  className="absolute end-0.5 top-1/2 -translate-y-1/2 flex min-h-11 min-w-11 items-center justify-center text-muted-foreground hover:text-foreground rounded-md focus-visible:ring-1 focus-visible:ring-primary"
                >
                  <X className="w-4 h-4" aria-hidden="true" />
                </button>
              )}
            </div>
          )}

          <div
            role="region"
            aria-live="polite"
            aria-label={t("templateEditor.addFields")}
            className="space-y-1 max-h-64 overflow-y-auto pe-0.5"
          >
            {filteredFields.map((fieldOption) => (
              <Button
                type="button"
                key={String(fieldOption.field)}
                onClick={() => onAddField(fieldOption)}
                variant="outline"
                className={FIELD_BUTTON}
              >
                <div className="truncate">
                  <p className="truncate font-medium m-0">{fieldOption.label}</p>
                  <p className="text-2xs text-muted-foreground font-mono m-0 truncate">
                    <span dir="ltr" className="inline-block font-mono">
                      {`{${String(fieldOption.field)}}`}
                    </span>
                  </p>
                </div>
                <Plus
                  className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity text-primary shrink-0"
                  aria-hidden="true"
                />
              </Button>
            ))}
            {filteredFields.length === 0 && (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <Search className="w-4 h-4 text-muted-foreground/40 mb-1" aria-hidden="true" />
                <p className="text-xs text-muted-foreground m-0">
                  {t("templateEditor.noFieldsMatched")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </aside>
  );
}
