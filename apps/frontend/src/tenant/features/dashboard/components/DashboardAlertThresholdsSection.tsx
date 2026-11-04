import React, { useState } from "react";
import { SectionCard } from "@/components/app/SectionCard";
import { Field } from "@/components/app/FormField";
import { Input } from "@/components/ui/input";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface DashboardAlertThresholdsSectionProps {
  lowAttendanceThreshold?: number;
  urgentAttendanceThreshold?: number;
  onUpdateThreshold: (
    key: "lowAttendanceThreshold" | "urgentAttendanceThreshold",
    value: number,
  ) => void;
  hasGridMode: boolean;
  t: TranslationFunction;
}

export function DashboardAlertThresholdsSection({
  lowAttendanceThreshold,
  urgentAttendanceThreshold,
  onUpdateThreshold,
  hasGridMode,
  t,
}: DashboardAlertThresholdsSectionProps): React.JSX.Element {
  const title = t("dashboard.alertSettings");
  // Draft + commit on blur: each keystroke used to send a full-document PUT, so
  // typing "60" issued three writes that could land out of order.
  const [lowDraft, setLowDraft] = useState(() => String(lowAttendanceThreshold ?? 75));
  const [urgentDraft, setUrgentDraft] = useState(() => String(urgentAttendanceThreshold ?? 60));

  // Derived-state reset during render (the project's lint rule forbids
  // setState in an effect): a server-side change from another editor refreshes
  // the draft, while ordinary typing keeps the local value until blur.
  const [previousLow, setPreviousLow] = useState(lowAttendanceThreshold);
  const [previousUrgent, setPreviousUrgent] = useState(urgentAttendanceThreshold);
  if (previousLow !== lowAttendanceThreshold) {
    setPreviousLow(lowAttendanceThreshold);
    setLowDraft(String(lowAttendanceThreshold ?? 75));
  }
  if (previousUrgent !== urgentAttendanceThreshold) {
    setPreviousUrgent(urgentAttendanceThreshold);
    setUrgentDraft(String(urgentAttendanceThreshold ?? 60));
  }

  const commitThreshold = (
    key: "lowAttendanceThreshold" | "urgentAttendanceThreshold",
    draft: string,
    fallback: number,
    setDraft: (value: string) => void,
  ) => {
    const value = parseInt(draft, 10);
    if (!Number.isNaN(value) && value >= 1 && value <= 100) {
      onUpdateThreshold(key, value);
      setDraft(String(value));
      return;
    }
    setDraft(String(fallback));
  };
  return (
    <div className={hasGridMode ? "md:col-span-1" : "md:col-span-2"}>
      <SectionCard
        title={title}
        subtitle={t("dashboard.alertSettingsDesc")}
        padding="p-6"
        accentColor="primary"
      >
        <fieldset className="space-y-4 border-0 p-0 m-0 min-w-0">
          <legend className="sr-only">{title}</legend>
          <div className="space-y-2 max-h-preview-tall overflow-y-auto pe-1">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              <Field id="pref-low-att" label={t("dashboard.lowAttendanceThresholdLabel")}>
                <Input
                  id="pref-low-att"
                  name="lowAttendanceThreshold"
                  type="text"
                  inputMode="numeric"
                  value={lowDraft}
                  onChange={(e) => setLowDraft(e.target.value)}
                  onBlur={() =>
                    commitThreshold(
                      "lowAttendanceThreshold",
                      lowDraft,
                      lowAttendanceThreshold ?? 75,
                      setLowDraft,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="min-h-11 text-sm"
                />
              </Field>
              <Field id="pref-urgent-att" label={t("dashboard.urgentAttendanceThresholdLabel")}>
                <Input
                  id="pref-urgent-att"
                  name="urgentAttendanceThreshold"
                  type="text"
                  inputMode="numeric"
                  value={urgentDraft}
                  onChange={(e) => setUrgentDraft(e.target.value)}
                  onBlur={() =>
                    commitThreshold(
                      "urgentAttendanceThreshold",
                      urgentDraft,
                      urgentAttendanceThreshold ?? 60,
                      setUrgentDraft,
                    )
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="min-h-11 text-sm"
                />
              </Field>
            </div>
          </div>
        </fieldset>
      </SectionCard>
    </div>
  );
}
