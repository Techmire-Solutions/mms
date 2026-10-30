import { User } from "lucide-react";

import { useTranslation } from "@/hooks/useTranslation";

import type { BrandSemanticPreviewContext } from "./brandColorPanelShared";

export function BrandSemanticPreviewDocumentTab({
  activeOnPrimaryBg,
  activeOnSecondaryBg,
}: BrandSemanticPreviewContext) {
  const { t } = useTranslation();

  return (
    <div className="flex justify-center p-6 bg-muted/15">
      {/* Student ID Badge Mockup */}
      <div className="w-full max-w-xs overflow-hidden rounded-2xl border border-border/80 bg-card shadow-lg transition-shadow hover:shadow-xl">
        <div
          className="px-5 py-3.5 text-center text-white"
          style={{ backgroundColor: activeOnPrimaryBg }}
        >
          <p className="text-3xs uppercase tracking-widest font-extrabold opacity-90">
            {t("theme.previewStudentCardTitle")}
          </p>
          <p className="text-sm font-bold mt-0.5 tracking-tight">Madrasa Noor-ul-Quran</p>
        </div>
        <div className="p-4 flex items-center gap-4">
          <div
            className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border-2 border-dashed bg-muted/30 shadow-inner"
            style={{ borderColor: activeOnSecondaryBg }}
          >
            <User className="h-8 w-8 text-muted-foreground" />
          </div>
          <div className="space-y-1 min-w-0">
            <p className="text-sm font-bold text-foreground truncate">Zayd Al-Mansoor</p>
            <p className="text-xs text-muted-foreground">{t("theme.previewStudentCardRole")}</p>
            <p className="font-mono text-2xs text-muted-foreground">
              {t("theme.previewStudentCardId")}
            </p>
            <span
              className="inline-block mt-1 px-2 py-0.5 rounded-md text-3xs font-bold uppercase tracking-wider shadow-2xs"
              style={{
                backgroundColor: `${activeOnSecondaryBg}18`,
                color: activeOnSecondaryBg,
              }}
            >
              Active 2026/27
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
