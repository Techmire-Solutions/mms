import { AnimatePresence, motion } from "framer-motion";
import { SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { StatusBadge } from "@/components/app/StatusBadge";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";
import { SEMANTIC_BADGE } from "@/lib/ui/semanticTone";
import { useTranslation } from "@/hooks/useTranslation";
import type { CustomCard } from "@/lib/reports/reportMetadata";
import type { CategorizedKPIItem, KPIItem } from "./kpiSummaryTypes";

interface KPISummarySettingsProps {
  category: string;
  moduleLabel: string;
  isOpen: boolean;
  cards: CategorizedKPIItem[];
  customCards: CustomCard[];
  selectedCardIds: string[];
  primaryVolume: number;
  defaultCollection?: CustomCard["collection"];
  editingCardConfig?: CustomCard | null;
  cardBuilder?: React.ReactNode;
  onOpenChange: (isOpen: boolean) => void;
  onCancelEdit?: () => void;
  onToggleCard: (cardId: string) => void;
  onEditCard: (card: KPIItem) => void;
  onDeleteCard: (cardId: string) => void;
}

export function KPISummarySettings({
  category,
  moduleLabel,
  isOpen,
  cards,
  customCards,
  selectedCardIds,
  primaryVolume,
  defaultCollection: _defaultCollection,
  editingCardConfig: _editingCardConfig,
  cardBuilder,
  onOpenChange,
  onCancelEdit: _onCancelEdit,
  onToggleCard,
  onEditCard,
  onDeleteCard,
}: KPISummarySettingsProps): JSX.Element {
  const { t } = useTranslation();
  const selectedCardSet = new Set(selectedCardIds);
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <span className="min-w-0 truncate font-bold uppercase leading-none tracking-widest text-muted-foreground">
          {t("reports.kpiSectionTitle", { module: moduleLabel })}
        </span>
        <Button
          type="button"
          variant="outline"
          onClick={() => onOpenChange(!isOpen)}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-lg border border-border bg-card/60 px-2.5 font-semibold text-muted-foreground shadow-sm backdrop-blur-md hover:bg-card hover:text-primary"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
          {t("reports.kpiCustomize")}
        </Button>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            id={`config-panel-${category}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className={cn(WORK_SURFACE, "space-y-4 overflow-hidden p-4 font-sans")}
          >
            <div className="flex flex-col items-start justify-between gap-3 border-b border-border pb-3 sm:flex-row sm:items-center">
              <div>
                <h4 className="text-sm font-bold text-foreground">
                  {t("reports.kpiSettingsTitle")}
                </h4>
                <p className="text-xs text-muted-foreground">{t("reports.kpiSettingsDesc")}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge
                  status="selected"
                  size="sm"
                  config={{
                    selected: {
                      label: t("reports.kpiSelectedCount", { count: selectedCardIds.length }),
                      cls: SEMANTIC_BADGE.success,
                    },
                  }}
                />
                <StatusBadge
                  status="volume"
                  size="sm"
                  config={{
                    volume: {
                      label: t("reports.kpiDataVolume", { count: primaryVolume }),
                      cls: "bg-primary/10 text-primary border-primary/20",
                    },
                  }}
                />
              </div>
            </div>
            <div className="grid grid-cols-1 gap-6 border-t border-border pt-4 lg:grid-cols-3">
              <div className="lg:col-span-2">{cardBuilder}</div>
              <div className="flex flex-col justify-between space-y-4 rounded-2xl border border-border/50 bg-card/25 p-5 text-start shadow-inner">
                <div>
                  <div className="border-b border-border pb-2">
                    <h4 className="text-xs font-black uppercase leading-none tracking-widest text-foreground">
                      {t("reports.kpiVisibility")}
                    </h4>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {t("reports.kpiVisibilityDesc")}
                  </p>
                  <div className="mt-3 max-h-scroll-lg space-y-1.5 overflow-y-auto pe-1">
                    {cards.map((kpi) => {
                      const isSelected = selectedCardSet.has(kpi.id);
                      const isCustom = customCards.some((card) => card.id === kpi.id);
                      return (
                        <div
                          key={kpi.id}
                          className="flex items-center justify-between rounded-xl border border-border/40 bg-card/10 p-2.5 font-sans transition-all hover:bg-card/20"
                        >
                          <div className="flex min-w-0 flex-1 items-center gap-2.5">
                            <Checkbox
                              id={`kpi-${kpi.id}`}
                              checked={isSelected}
                              onCheckedChange={() => onToggleCard(kpi.id)}
                              className="h-3.5 w-3.5"
                              aria-label={kpi.label}
                            />
                            <label
                              htmlFor={`kpi-${kpi.id}`}
                              className="min-w-0 flex-1 cursor-pointer"
                            >
                              <p className="truncate text-xs font-bold leading-tight text-foreground">
                                {kpi.label}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1 text-xs font-semibold leading-none text-muted-foreground">
                                <span className={isCustom ? "text-primary" : "text-success"}>
                                  {t(isCustom ? "reports.kpiCustomCard" : "reports.kpiActiveData")}
                                </span>
                              </p>
                            </label>
                          </div>
                          <div className="flex shrink-0 items-center gap-1">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => onEditCard(kpi)}
                              className="rounded text-muted-foreground shadow-none hover:bg-primary/10 hover:text-primary"
                              title={t("reports.kpiEditConfig")}
                            >
                              <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
                            </Button>
                            {isCustom && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={() => onDeleteCard(kpi.id)}
                                className="rounded text-muted-foreground shadow-none hover:bg-destructive/10 hover:text-destructive"
                                title={t("reports.kpiDeleteConfig")}
                              >
                                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                              </Button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                <div className="mt-3 border-t border-border pt-3">
                  <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                    <span>{t("reports.kpiActiveSelection")}</span>
                    <span className="text-foreground">
                      {t("reports.kpiSelectionRatio", {
                        current: selectedCardIds.length,
                        total: cards.length,
                      })}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
