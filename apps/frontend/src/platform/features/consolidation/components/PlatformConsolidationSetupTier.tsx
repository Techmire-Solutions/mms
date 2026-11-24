import React, { useState } from "react";
import { Settings } from "lucide-react";
import {
  ISO_4217_CURRENCIES,
  DEFAULT_PLATFORM_CONSOLIDATION_PREFS,
  type PlatformConsolidationPrefs,
} from "@mms/contracts";
import { SettingsPanel } from "@/components/app/SettingsShell";
import { SectionCard } from "@mms/ui";
import { SettingsFormActions } from "@/components/app/SettingsFormActions";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { CardSkeleton } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { useSavedFlash } from "@/hooks/useSavedFlash";
import { PlatformSettingsLoadError } from "@/platform/features/settings/components/PlatformSettingsLoadError";
import {
  usePlatformSettingsQuery,
  useUpdatePlatformSettings,
} from "@/platform/features/settings/hooks/usePlatformSettings";

const CURRENCY_OPTIONS = ISO_4217_CURRENCIES.map((currency) => ({
  value: currency.code,
  label: `${currency.code} – ${currency.name}`,
}));

const MONTH_OPTIONS = Array.from({ length: 12 }, (_, index) => ({
  value: String(index + 1),
  label: String(index + 1),
}));

/** Consolidation → Setup: default presentation currency + fiscal year start (dirty-gated). */
export function PlatformConsolidationSetupTier(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: settings, isLoading, isError, refetch } = usePlatformSettingsQuery();
  const update = useUpdatePlatformSettings();
  const { saved, flashSaved } = useSavedFlash();

  const [draft, setDraft] = useState<PlatformConsolidationPrefs | null>(null);
  const [prevPrefs, setPrevPrefs] = useState(settings?.consolidationPrefs);

  const serverPrefs = settings?.consolidationPrefs ?? DEFAULT_PLATFORM_CONSOLIDATION_PREFS;
  const isDirty = Boolean(draft) && JSON.stringify(draft) !== JSON.stringify(serverPrefs);

  if (settings?.consolidationPrefs !== prevPrefs) {
    setPrevPrefs(settings?.consolidationPrefs);
    if (settings?.consolidationPrefs && (!draft || !isDirty)) {
      setDraft(settings.consolidationPrefs);
    }
  }

  if (isLoading || !draft) return <CardSkeleton count={2} />;
  if (isError) return <PlatformSettingsLoadError onRetry={() => void refetch()} />;

  const handleSave = async (): Promise<void> => {
    await update.mutateAsync({ consolidationPrefs: draft });
    flashSaved();
  };

  return (
    <SettingsPanel
      width="medium"
      introKey="platform.consolidation.setupIntro"
      isDirty={isDirty}
      saved={saved}
      footer={
        <SettingsFormActions
          saveLabel={t("common.save")}
          onSave={() => void handleSave()}
          onDiscard={() => setDraft(serverPrefs)}
          dirty={isDirty}
          saving={update.isPending}
          discardLabel={t("theme.discardChanges")}
        />
      }
    >
      <SectionCard
        title={t("platform.consolidation.setupDefaultsTitle")}
        subtitle={t("platform.consolidation.setupDefaultsDesc")}
        icon={Settings}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="cons-prefs-currency" label={t("platform.consolidation.presentationCurrency")}>
            <FormSelect
              id="cons-prefs-currency"
              name="defaultPresentationCurrency"
              value={draft.defaultPresentationCurrency}
              onChange={(value) =>
                setDraft((current) =>
                  current ? { ...current, defaultPresentationCurrency: value } : current,
                )
              }
              options={CURRENCY_OPTIONS}
            />
          </Field>
          <Field id="cons-prefs-month" label={t("platform.consolidation.fiscalYearStart")}>
            <FormSelect
              id="cons-prefs-month"
              name="fiscalYearStartMonth"
              value={String(draft.fiscalYearStartMonth)}
              onChange={(value) =>
                setDraft((current) =>
                  current ? { ...current, fiscalYearStartMonth: Number(value) } : current,
                )
              }
              options={MONTH_OPTIONS}
            />
          </Field>
        </div>
      </SectionCard>
    </SettingsPanel>
  );
}
