import { CheckSquare, Search } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";

import type { BrandSemanticPreviewContext } from "./brandColorPanelShared";

export function BrandSemanticPreviewTableTab({ activeOnPrimaryBg }: BrandSemanticPreviewContext) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3.5 bg-muted/10 p-4">
      {/* Search Input Mockup */}
      <div className="relative max-w-sm">
        <Search
          className="absolute start-3 top-3.5 h-3.5 w-3.5 text-muted-foreground"
          aria-hidden
        />
        <input
          type="text"
          readOnly
          tabIndex={-1}
          aria-hidden
          placeholder={t("theme.previewSearchPlaceholder")}
          className="h-11 min-h-11 w-full rounded-lg border border-input bg-background ps-9 pe-3 text-xs shadow-xs focus:outline-none"
          style={{ borderColor: activeOnPrimaryBg }}
        />
      </div>

      {/* Data Table Row Mockup */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-xs">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4" style={{ color: activeOnPrimaryBg }} aria-hidden />
            <span>Student & Course</span>
          </span>
          <span>Status</span>
        </div>
        <div className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/20 transition-colors">
          <div className="flex items-center gap-3">
            <div
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-bold text-xs text-white shadow-xs"
              style={{ backgroundColor: activeOnPrimaryBg }}
            >
              SA
            </div>
            <div>
              <p className="text-xs font-semibold text-foreground">
                {t("theme.previewTableRowTitle")}
              </p>
              <p className="text-2xs text-muted-foreground">{t("theme.previewTableRowSubtitle")}</p>
            </div>
          </div>
          <span
            className="inline-flex items-center font-bold rounded-md border px-2.5 py-0.5 text-2xs shadow-2xs transition-all"
            style={{
              backgroundColor: `${activeOnPrimaryBg}18`,
              color: activeOnPrimaryBg,
              borderColor: `${activeOnPrimaryBg}35`,
            }}
          >
            {t("theme.previewTableRowBadge")}
          </span>
        </div>
      </div>
    </div>
  );
}
