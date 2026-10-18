import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { CompactSegmentedControl } from "@/components/app/CompactSegmentedControl";
import { SectionLabel } from "@/components/app/SectionLabel";

interface DashboardWidgetsHeaderProps {
  gridMode: "comfortable" | "compact";
  onToggleGridMode: (mode: "comfortable" | "compact") => void;
}

export function DashboardWidgetsHeader({
  gridMode,
  onToggleGridMode,
}: DashboardWidgetsHeaderProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-2">
        <LayoutDashboard className="w-4 h-4 shrink-0 text-primary" />
        <SectionLabel as="h3" tone="foreground" className="min-w-0 truncate leading-none">
          {t("reports.widgets.pinnedPanels")}
        </SectionLabel>
      </div>

      <CompactSegmentedControl
        tone="card"
        animated
        ariaLabel={t("reports.widgets.pinnedPanels")}
        className="shrink-0 bg-muted/20 shadow-inner backdrop-blur-xs"
        value={gridMode}
        onChange={onToggleGridMode}
        options={[
          { value: "comfortable", label: t("reports.widgets.comfortable") },
          { value: "compact", label: t("reports.widgets.compact") },
        ]}
      />
    </div>
  );
}
