import React from "react";
import { Info } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export function WidgetBuilderHeader(): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="pb-3 border-b border-border flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <h4 className="text-sm font-bold text-foreground font-sans">
          {t("reports.widgets.builder.title")}
        </h4>
        <p className="text-xs text-muted-foreground">{t("reports.widgets.builder.subtitle")}</p>
      </div>
      <div className="flex items-start gap-2 bg-primary/10 border border-primary/20 p-2.5 rounded-xl max-w-sm">
        <Info className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-normal">
          <span className="font-black text-primary uppercase block mb-0.5">
            {t("reports.widgets.builder.singleMetricRule")}
          </span>
          {t("reports.widgets.builder.singleMetricRuleDesc")}
        </p>
      </div>
    </div>
  );
}
