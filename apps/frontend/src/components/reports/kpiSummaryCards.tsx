import { useState } from "react";
import { motion } from "framer-motion";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import {
  CARD_STRIPE_BASE,
  CARD_STRIPE_INSET,
  CARD_STRIPE_COLORS,
  type CardAccentColor,
} from "@/lib/semanticTone";
import { cn } from "@/lib/utils";
import type { CategorizedKPIItem } from "./kpiSummaryTypes";

const COLOR = {
  primary: { bg: "bg-primary/10", text: "text-primary" },
  success: { bg: "bg-success/10", text: "text-success" },
  info: { bg: "bg-info/10", text: "text-info" },
  warning: { bg: "bg-warning/10", text: "text-warning" },
  destructive: { bg: "bg-destructive/10", text: "text-destructive" },
  secondary: { bg: "bg-secondary/10", text: "text-secondary-foreground" },
  muted: { bg: "bg-muted/30", text: "text-muted-foreground" },
  green: { bg: "bg-success/10", text: "text-success" },
  blue: { bg: "bg-info/10", text: "text-info" },
  red: { bg: "bg-destructive/10", text: "text-destructive" },
  amber: { bg: "bg-warning/10", text: "text-warning" },
  violet: { bg: "bg-primary/10", text: "text-primary" },
} as const;

const TREND = {
  up: { className: "text-success", arrow: "↑" },
  down: { className: "text-destructive", arrow: "↓" },
  flat: { className: "text-muted-foreground", arrow: "→" },
} as const;

function SubtextDisplay({ text }: { text: string }): JSX.Element {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (text.length <= 30) return <span className="block truncate font-semibold">{text}</span>;

  return (
    <span className="block whitespace-normal break-words font-semibold leading-normal">
      {expanded ? text : `${text.slice(0, 30)}...`}
      <Button
        type="button"
        variant="link"
        onClick={(event) => {
          event.stopPropagation();
          setExpanded((previousExpanded) => !previousExpanded);
        }}
        className="ms-1 inline-flex min-h-11 items-center px-1 text-xs font-extrabold text-primary shadow-none hover:underline"
      >
        {expanded ? t("common.showLess") : t("common.readMore")}
      </Button>
    </span>
  );
}

interface KPICardsGridProps {
  cards: CategorizedKPIItem[];
  onAddCustom: () => void;
}

export function KPICardsGrid({ cards, onAddCustom }: KPICardsGridProps): JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();
  return (
    <div className="grid grid-cols-2 gap-3 font-sans sm:grid-cols-4 lg:grid-cols-8">
      {cards.map((kpi, index) => {
        const kpiColor = COLOR[kpi.color];
        const trend = TREND[kpi.trend];
        const Icon = kpi.icon;
        return (
          <motion.article
            key={kpi.id}
            initial={reducedMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={reducedMotion ? { duration: 0 } : { delay: index * 0.04 }}
            className={cn(
              "group relative overflow-hidden flex min-h-card-sm flex-col justify-between rounded-2xl border border-border bg-card/60 p-3.5 text-start shadow-sm backdrop-blur-md transition-all hover:border-primary/20 hover:shadow-md",
              CARD_STRIPE_INSET,
            )}
          >
            <div
              aria-hidden="true"
              className={cn(
                CARD_STRIPE_BASE,
                CARD_STRIPE_COLORS[kpi.color as CardAccentColor] ?? CARD_STRIPE_COLORS.primary,
                "transition-colors duration-150 ease-out",
              )}
            />
            <header className="flex select-none items-center justify-between gap-1.5">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-115 ${kpiColor.bg}`}
              >
                <Icon className={`h-4 w-4 ${kpiColor.text}`} aria-hidden="true" />
              </div>
            </header>
            <div className="mt-2 min-w-0 flex-1 space-y-0.5">
              <span className="block truncate text-xs font-bold uppercase leading-none tracking-widest text-muted-foreground">
                {kpi.label}
              </span>
              <p className={`mt-0.5 truncate text-lg font-black leading-tight ${kpiColor.text}`}>
                {kpi.value}
              </p>
            </div>
            <footer className="mt-2 min-w-0 border-t border-border/20 pt-1.5 text-xs text-muted-foreground">
              <div className="mb-0.5 flex select-none items-center gap-1 font-sans">
                <span className={`text-xs font-black ${trend.className}`}>
                  {trend.arrow} {kpi.velocity || ""}
                </span>
                {kpi.velocity && (
                  <span className="text-xs font-medium text-muted-foreground opacity-60">
                    {t("reports.kpiVsPrev")}
                  </span>
                )}
              </div>
              <SubtextDisplay text={kpi.sub} />
            </footer>
          </motion.article>
        );
      })}
      <Button
        type="button"
        variant="ghost"
        onClick={onAddCustom}
        className="flex min-h-card-mini h-auto flex-col items-center justify-center rounded-2xl border border-dashed border-border/85 bg-card/25 p-3 text-center text-muted-foreground transition-all duration-300 hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
      >
        <Plus className="mb-1 h-5 w-5" aria-hidden="true" />
        <span className="text-xs font-bold">{t("reports.kpiAddCustom")}</span>
      </Button>
    </div>
  );
}
