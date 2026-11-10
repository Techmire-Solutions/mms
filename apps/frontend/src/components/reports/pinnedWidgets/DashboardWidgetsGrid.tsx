import { PinOff, Trash2, Pencil } from "lucide-react";
import { m, AnimatePresence } from "framer-motion";
import { useTranslation } from "@/hooks/useTranslation";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { ErrorBoundary } from "@/components/app/ErrorBoundary";
import { Button } from "@/components/ui/button";
import { isComposedWidgetType } from "@/components/dashboard-widgets/registry";
import { isSeededDashboardWidget } from "@/lib/dashboardWidgets";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

interface DashboardWidgetsGridProps {
  widgets: CustomWidget[];
  gridMode: "comfortable" | "compact";
  isEditMode: boolean;
  onUnpin: (id: string) => void;
  onEditWidget?: (widget: CustomWidget) => void;
  onDeleteWidget?: (id: string) => void;
  renderWidget: (widget: CustomWidget, isCompact: boolean) => React.ReactNode;
}

export function DashboardWidgetsGrid({
  widgets,
  gridMode,
  isEditMode,
  onUnpin,
  onEditWidget,
  onDeleteWidget,
  renderWidget,
}: DashboardWidgetsGridProps): React.JSX.Element {
  const { t } = useTranslation();
  const reducedMotion = useReducedMotion();

  return (
    <div
      className={
        gridMode === "compact"
          ? "flex flex-wrap gap-2.5 pt-1"
          : "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pt-1"
      }
    >
      <AnimatePresence mode="popLayout">
        {widgets.map((widget) => {
          let colSpanClass = "";
          if (gridMode !== "compact") {
            if (widget.widgetType === "overdue-obligations") {
              colSpanClass = "col-span-full";
            } else if (isComposedWidgetType(widget.widgetType)) {
              colSpanClass = "lg:col-span-2 md:col-span-3 col-span-1";
            }
          }
          return (
            <m.div
              key={widget.id}
              layout={!reducedMotion}
              initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reducedMotion ? undefined : { opacity: 0, scale: 0.95 }}
              transition={
                reducedMotion ? { duration: 0 } : { type: "spring", stiffness: 350, damping: 25 }
              }
              className={`relative group ${colSpanClass}`}
            >
              <ErrorBoundary>{renderWidget(widget, gridMode === "compact")}</ErrorBoundary>

              {isEditMode ? (
                <div
                  className={`absolute top-2.5 end-2.5 flex items-center gap-1 z-elevated ${
                    gridMode === "compact" ? "top-0.5 end-0.5" : ""
                  }`}
                >
                  {onEditWidget && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={(event) => {
                        event.stopPropagation();
                        onEditWidget(widget);
                      }}
                      className="rounded bg-card/85 backdrop-blur border border-border/60 hover:bg-primary hover:text-primary-foreground text-muted-foreground shadow-none"
                      title={t("reports.widgets.editWidget")}
                      aria-label={t("reports.widgets.editWidget")}
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                  )}
                  {onDeleteWidget && !isSeededDashboardWidget(widget.id) && (
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={(event) => {
                        event.stopPropagation();
                        onDeleteWidget(widget.id);
                      }}
                      className="rounded bg-card/85 backdrop-blur border border-border/60 hover:bg-destructive hover:text-destructive-foreground text-muted-foreground shadow-none"
                      title={t("reports.widgets.deleteWidget")}
                      aria-label={t("reports.widgets.deleteWidget")}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={() => onUnpin(widget.id)}
                    className="rounded bg-card/85 backdrop-blur border border-border/60 hover:bg-destructive/10 text-muted-foreground hover:text-destructive shadow-none"
                    title={t("reports.widgets.unpinWidget")}
                    aria-label={t("reports.widgets.unpinWidget")}
                  >
                    <PinOff className="w-3 h-3" />
                  </Button>
                </div>
              ) : null}
            </m.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
