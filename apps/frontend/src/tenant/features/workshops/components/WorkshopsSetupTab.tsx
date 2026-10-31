import React, { useState } from "react";
import { Save } from "lucide-react";
import { workshopPreferencesSchema, type WorkshopPreferences } from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { ErrorState } from "@/components/app/ErrorState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useSaveWorkshopPreferences,
  useWorkshopPreferences,
} from "../hooks/useWorkshopsCompletionApi";

const toText = (value: number | null) => (value === null ? "" : String(value));
const toPct = (value: string) => (value.trim() === "" ? null : Number(value.trim()));

function PreferencesForm({
  saved,
  canEditSetup,
}: {
  saved: WorkshopPreferences;
  canEditSetup: boolean;
}): React.JSX.Element {
  const { t } = useTranslation();
  const [attendance, setAttendance] = useState(toText(saved.defaultMinAttendancePct));
  const [score, setScore] = useState(toText(saved.defaultMinScorePct));
  const save = useSaveWorkshopPreferences();

  const handleSave = async () => {
    const parsed = workshopPreferencesSchema.safeParse({
      defaultMinAttendancePct: toPct(attendance),
      defaultMinScorePct: toPct(score),
    });
    if (!parsed.success) {
      notify.error(t("workshops.setup.invalidPct"));
      return;
    }
    try {
      await save.mutateAsync(parsed.data);
      notify.success(t("workshops.setup.saved"));
    } catch (err) {
      notify.error(err instanceof Error ? err.message : t("workshops.saveFailed"));
    }
  };

  return (
    <section
      aria-labelledby="workshops-setup-heading"
      className="space-y-4 rounded-lg border border-border bg-card p-4 text-start"
    >
      <div>
        <h2 id="workshops-setup-heading" className="text-sm font-semibold text-foreground">
          {t("workshops.setup.heading")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("workshops.setup.description")}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field id="workshops-default-attendance" label={t("workshops.minAttendancePct")}>
          <Input
            id="workshops-default-attendance"
            name="defaultMinAttendancePct"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={attendance}
            disabled={!canEditSetup}
            onChange={(e) => setAttendance(e.target.value)}
            placeholder={t("workshops.criterionNotUsed")}
          />
        </Field>
        <Field id="workshops-default-score" label={t("workshops.minScorePct")}>
          <Input
            id="workshops-default-score"
            name="defaultMinScorePct"
            type="number"
            inputMode="decimal"
            min={0}
            max={100}
            value={score}
            disabled={!canEditSetup}
            onChange={(e) => setScore(e.target.value)}
            placeholder={t("workshops.criterionNotUsed")}
          />
        </Field>
      </div>
      {canEditSetup ? (
        <Button
          type="button"
          icon={Save}
          className="min-h-11"
          disabled={save.isPending}
          onClick={() => void handleSave()}
        >
          {t("common.save")}
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">{t("workshops.setup.readOnly")}</p>
      )}
    </section>
  );
}

/** Workshops Setup tier — default completion criteria copied into new workshops. */
export function WorkshopsSetupTab({ canEditSetup }: { canEditSetup: boolean }): React.JSX.Element {
  const { t } = useTranslation();
  const preferences = useWorkshopPreferences();

  if (preferences.isError) {
    return (
      <ErrorState
        title={t("workshops.loadFailed")}
        description={t("workshops.loadFailedHint")}
        onRetry={() => void preferences.refetch()}
      />
    );
  }
  if (!preferences.data) {
    return <p className="text-sm text-muted-foreground">{t("common.loading")}</p>;
  }
  // Keyed on the saved values so a save (or another user's change) resets the inputs.
  const key = `${preferences.data.defaultMinAttendancePct}:${preferences.data.defaultMinScorePct}`;
  return <PreferencesForm key={key} saved={preferences.data} canEditSetup={canEditSetup} />;
}
