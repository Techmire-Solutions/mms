import React, { useState } from "react";
import { Award, ChevronDown, ChevronUp, Scroll } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SectionCard } from "@/components/app/SectionCard";
import { useTranslation } from "@/hooks/useTranslation";
import type { FacultyIjazah, FacultyMember } from "@mms/shared";

export interface FacultyDetailIjazahSectionProps {
  faculty: FacultyMember;
}

export function FacultyDetailIjazahSection({
  faculty,
}: FacultyDetailIjazahSectionProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const ijazahs = faculty.ijazahs ?? [];
  const [expandedSanadIds, setExpandedSanadIds] = useState<Record<string, boolean>>({});

  if (ijazahs.length === 0) {
    return null;
  }

  const toggleSanad = (id: string) => {
    setExpandedSanadIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const disciplineLabels: Record<string, string> = {
    quran: t("faculty.ijazah.discipline.quran"),
    hadith: t("faculty.ijazah.discipline.hadith"),
    fiqh: t("faculty.ijazah.discipline.fiqh"),
    arabic: t("faculty.ijazah.discipline.arabic"),
    aqeedah: t("faculty.ijazah.discipline.aqeedah"),
    other: t("faculty.ijazah.discipline.other"),
  };

  return (
    <SectionCard title={t("faculty.ijazah.title")} icon={Award} accentColor="primary">
      <div className="space-y-3">
        {ijazahs.map((ijazah: FacultyIjazah) => {
          const isSanadExpanded = Boolean(expandedSanadIds[ijazah.id]);
          const disciplineLabel = disciplineLabels[ijazah.field] ?? ijazah.field;

          return (
            <div
              key={ijazah.id}
              className="p-3 rounded-lg border border-border/70 bg-card/60 space-y-2 text-start transition-all"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 min-w-0">
                  <span className="font-semibold text-sm text-foreground truncate text-balance">
                    {ijazah.title}
                  </span>
                  <span className="px-2 py-0.5 rounded text-3xs font-medium bg-primary/10 text-primary border border-primary/20">
                    {disciplineLabel}
                  </span>
                  {ijazah.year ? (
                    <span className="text-xs text-muted-foreground font-medium">
                      ({ijazah.year})
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                <span className="text-foreground/70">{t("faculty.ijazah.grantingAuthority")}:</span>
                <span className="font-medium text-foreground">{ijazah.grantingAuthority}</span>
              </div>

              {ijazah.sanadChain ? (
                <div className="pt-2 border-t border-border/40 space-y-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleSanad(ijazah.id)}
                    className="min-h-9 px-2 text-xs text-muted-foreground hover:text-foreground gap-1.5 touch-manipulation"
                    aria-expanded={isSanadExpanded}
                  >
                    <Scroll className="w-3.5 h-3.5 text-primary" aria-hidden />
                    <span>{t("faculty.ijazah.sanadExpand")}</span>
                    {isSanadExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" aria-hidden />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" aria-hidden />
                    )}
                  </Button>

                  {isSanadExpanded && (
                    <div
                      dir="auto"
                      className="p-3 rounded-md bg-muted/40 border border-border/60 text-xs text-foreground/90 leading-relaxed font-serif whitespace-pre-wrap text-pretty animate-in fade-in duration-150"
                    >
                      {ijazah.sanadChain}
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
export default FacultyDetailIjazahSection;
