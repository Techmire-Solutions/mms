import React from "react";
import { Search } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { Button } from "@shared/ui";
import { Input } from "@shared/ui";
import { LeadingIconInput } from "@/components/app/LeadingIconInput";
import { Textarea } from "@shared/ui";
import { Checkbox } from "@shared/ui";
import { Switch } from "@shared/ui";
import { FormSelect } from "@/components/app/FormSelect";
import { Badge } from "@shared/ui";
import { StatusBadge } from "@/components/app/StatusBadge";
import { EmptyState } from "@/components/app/EmptyState";
import { ErrorState } from "@/components/app/ErrorState";
import { WarningCallout } from "@/components/app/WarningCallout";
import { CompactSegmentedControl } from "@/components/app/CompactSegmentedControl";
import { DateRangeFilterBar } from "@/components/app/DateRangeFilterBar";
import { DensityToggle, type DensityMode } from "@/components/app/DensityToggle";
import { Inbox } from "lucide-react";

export function DesignSystemActionsDemo(): React.JSX.Element {
  const { t } = useTranslation();
  const [density, setDensity] = React.useState<DensityMode>("standard");
  return (
    <>
      <Button className="min-h-11 cursor-pointer">Primary</Button>
      <Button variant="outline" className="min-h-11 cursor-pointer">
        Outline
      </Button>
      <Button variant="ghost" disabled className="min-h-11">
        Disabled
      </Button>
      <Button variant="default" size="sm">
        Action
      </Button>
      <Button variant="outline" size="sm" loading>
        Loading
      </Button>
      <DensityToggle
        density={density}
        onChange={setDensity}
        ariaLabel={t("dashboard.layoutDensity")}
        labels={{
          compact: t("dashboard.densityCompact"),
          standard: t("dashboard.densityStandard"),
          comfortable: t("dashboard.densityComfortable"),
        }}
      />
    </>
  );
}

export function DesignSystemInputsDemo(): React.JSX.Element {
  const { t } = useTranslation();
  const [seg, setSeg] = React.useState<"all" | "active">("all");
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  return (
    <div className="grid w-full max-w-xl grid-cols-1 gap-3">
      <Input placeholder="Input" className="min-h-11" />
      <LeadingIconInput icon={Search} placeholder="Leading icon input" />
      <Textarea placeholder="Textarea" rows={3} />
      <div className="flex items-center gap-3">
        <Checkbox id="ds-check" />
        <label htmlFor="ds-check" className="text-sm">
          Checkbox
        </label>
        <Switch id="ds-switch" />
        <label htmlFor="ds-switch" className="text-sm">
          Switch
        </label>
      </div>
      <FormSelect
        value="a"
        onChange={() => {}}
        options={[
          { value: "a", label: "Option A" },
          { value: "b", label: "Option B" },
        ]}
        aria-label="Form select"
      />
      <CompactSegmentedControl
        value={seg}
        onChange={setSeg}
        options={[
          { value: "all", label: t("platform.filterAll") },
          { value: "active", label: t("platform.workspaceActive") },
        ]}
      />
      <DateRangeFilterBar
        idPrefix="ds-gallery"
        dateFrom={from}
        dateTo={to}
        onDateFromChange={setFrom}
        onDateToChange={setTo}
        fromLabel={t("platform.dateFrom")}
        toLabel={t("platform.dateTo")}
      />
    </div>
  );
}

export function DesignSystemFeedbackDemo(): React.JSX.Element {
  const { t } = useTranslation();
  return (
    <div className="grid w-full grid-cols-1 gap-4 lg:grid-cols-2">
      <EmptyState
        compact
        icon={Inbox}
        title={t("backup.noData")}
        description={t("platform.designSystemFeedback")}
      />
      <ErrorState title={t("platform.loadFailed")} description={t("platform.loadFailedHint")} />
      <div className="flex flex-wrap gap-2">
        <Badge>Badge</Badge>
        <StatusBadge status="active" />
        <StatusBadge status="pending" />
      </div>
      <WarningCallout
        title={t("platform.designSystemFeedback")}
        description={t("platform.designSystemSubtitle")}
      />
    </div>
  );
}
