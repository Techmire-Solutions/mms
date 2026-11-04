import React, { useState } from "react";
import {
  DASHBOARD_LOW_ATTENDANCE_THRESHOLD,
  DASHBOARD_URGENT_ATTENDANCE_THRESHOLD,
} from "@mms/shared";
import { SectionCard } from "@/components/app/SectionCard";
import { Field, FieldErrorMessage } from "@/components/app/FormField";
import { Input } from "@/components/ui/input";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

export interface DashboardAlertThresholdsSectionProps {
  lowAttendanceThreshold?: number;
  urgentAttendanceThreshold?: number;
  onUpdateThreshold: (
    key: "lowAttendanceThreshold" | "urgentAttendanceThreshold",
    value: number,
  ) => void;
  t: TranslationFunction;
}

type ThresholdField = "low" | "urgent";

export function DashboardAlertThresholdsSection({
  lowAttendanceThreshold,
  urgentAttendanceThreshold,
  onUpdateThreshold,
  t,
}: DashboardAlertThresholdsSectionProps): React.JSX.Element {
  const title = t("dashboard.alertSettings");
  const committedLow = lowAttendanceThreshold ?? DASHBOARD_LOW_ATTENDANCE_THRESHOLD;
  const committedUrgent = urgentAttendanceThreshold ?? DASHBOARD_URGENT_ATTENDANCE_THRESHOLD;
  // Draft + commit on blur: each keystroke used to send a full-document PUT, so
  // typing "60" issued three writes that could land out of order.
  const [lowDraft, setLowDraft] = useState(() => String(committedLow));
  const [urgentDraft, setUrgentDraft] = useState(() => String(committedUrgent));
  // Invalid drafts used to revert silently; the field now says why.
  const [error, setError] = useState<{ field: ThresholdField; message: string } | null>(null);

  // Derived-state reset during render (the project's lint rule forbids
  // setState in an effect): a server-side change from another editor refreshes
  // the draft, while ordinary typing keeps the local value until blur.
  const [previousLow, setPreviousLow] = useState(lowAttendanceThreshold);
  const [previousUrgent, setPreviousUrgent] = useState(urgentAttendanceThreshold);
  if (previousLow !== lowAttendanceThreshold) {
    setPreviousLow(lowAttendanceThreshold);
    setLowDraft(String(committedLow));
  }
  if (previousUrgent !== urgentAttendanceThreshold) {
    setPreviousUrgent(urgentAttendanceThreshold);
    setUrgentDraft(String(committedUrgent));
  }

  const commitThreshold = (
    field: ThresholdField,
    draft: string,
    fallback: number,
    setDraft: (value: string) => void,
  ) => {
    const value = parseInt(draft, 10);
    if (Number.isNaN(value) || value < 1 || value > 100) {
      setError({ field, message: t("dashboard.thresholdRangeError") });
      setDraft(String(fallback));
      return;
    }
    // Alerts are ordered: the urgent line must stay below the low line, or every
    // low-attendance alert would immediately be urgent.
    if (field === "low" && value <= committedUrgent) {
      setError({ field, message: t("dashboard.thresholdOrderError") });
      setDraft(String(fallback));
      return;
    }
    if (field === "urgent" && value >= committedLow) {
      setError({ field, message: t("dashboard.thresholdOrderError") });
      setDraft(String(fallback));
      return;
    }
    setError(null);
    onUpdateThreshold(
      field === "low" ? "lowAttendanceThreshold" : "urgentAttendanceThreshold",
      value,
    );
    setDraft(String(value));
  };

  const lowError = error?.field === "low" ? error.message : undefined;
  const urgentError = error?.field === "urgent" ? error.message : undefined;

  return (
    <div className="md:col-span-2">
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
                  aria-invalid={Boolean(lowError)}
                  aria-describedby={lowError ? "pref-low-att-error" : undefined}
                  onChange={(e) => setLowDraft(e.target.value)}
                  onBlur={() => commitThreshold("low", lowDraft, committedLow, setLowDraft)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="min-h-11 text-sm"
                />
                {lowError ? (
                  <FieldErrorMessage message={lowError} className="mt-1" id="pref-low-att-error" />
                ) : null}
              </Field>
              <Field id="pref-urgent-att" label={t("dashboard.urgentAttendanceThresholdLabel")}>
                <Input
                  id="pref-urgent-att"
                  name="urgentAttendanceThreshold"
                  type="text"
                  inputMode="numeric"
                  value={urgentDraft}
                  aria-invalid={Boolean(urgentError)}
                  aria-describedby={urgentError ? "pref-urgent-att-error" : undefined}
                  onChange={(e) => setUrgentDraft(e.target.value)}
                  onBlur={() =>
                    commitThreshold("urgent", urgentDraft, committedUrgent, setUrgentDraft)
                  }
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                  }}
                  className="min-h-11 text-sm"
                />
                {urgentError ? (
                  <FieldErrorMessage
                    message={urgentError}
                    className="mt-1"
                    id="pref-urgent-att-error"
                  />
                ) : null}
              </Field>
            </div>
          </div>
        </fieldset>
      </SectionCard>
    </div>
  );
}
