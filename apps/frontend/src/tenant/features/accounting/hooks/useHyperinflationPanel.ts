import { useState } from "react";
import {
  DEFAULT_HYPERINFLATION_SETTINGS,
  todayISO,
  type HyperinflationSettings,
  type Ias29Run,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useHyperinflationSettings,
  useIas29Runs,
  usePostIas29,
  usePreviewIas29,
  usePriceIndices,
  useSaveHyperinflationSettings,
  useSavePriceIndices,
} from "@/tenant/features/accounting/hooks/useHyperinflation";

const errorText = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** State and actions for Setup → Hyperinflation (IAS 29): settings, price index, restatement. */
export function useHyperinflationPanel() {
  const { t } = useTranslation();
  const settings = useHyperinflationSettings();
  const saveSettings = useSaveHyperinflationSettings();
  const indices = usePriceIndices();
  const saveIndices = useSavePriceIndices();
  const runs = useIas29Runs();
  const preview = usePreviewIas29();
  const post = usePostIas29();

  const [draft, setDraft] = useState<HyperinflationSettings | null>(null);
  const current = draft ?? settings.data ?? DEFAULT_HYPERINFLATION_SETTINGS;
  const [indexDate, setIndexDate] = useState(todayISO());
  const [indexValue, setIndexValue] = useState("");
  const [restatementDate, setRestatementDate] = useState(todayISO());
  const [previewRun, setPreviewRun] = useState<Ias29Run | null>(null);

  const update = <K extends keyof HyperinflationSettings>(field: K, value: HyperinflationSettings[K]) =>
    setDraft({ ...current, [field]: value });

  const handleSaveSettings = async (): Promise<void> => {
    try {
      const { updatedAt: _updatedAt, ...body } = current;
      await saveSettings.mutateAsync(body);
      setDraft(null);
      notify.success(t("accounting.settings.ias29.saved"));
    } catch (error) {
      notify.error(t("accounting.settings.ias29.saveFailed"), { description: errorText(error) });
    }
  };

  const handleAddIndex = async (): Promise<void> => {
    try {
      await saveIndices.mutateAsync([{ indexDate, value: indexValue.trim(), source: current.indexName }]);
      setIndexValue("");
      notify.success(t("accounting.settings.ias29.indexSaved"));
    } catch (error) {
      notify.error(t("accounting.settings.ias29.indexSaveFailed"), { description: errorText(error) });
    }
  };

  const handlePreview = async (): Promise<void> => {
    try {
      setPreviewRun(await preview.mutateAsync(restatementDate));
    } catch (error) {
      setPreviewRun(null);
      notify.error(t("accounting.settings.ias29.previewFailed"), { description: errorText(error) });
    }
  };

  const handlePost = async (): Promise<void> => {
    try {
      const run = await post.mutateAsync(restatementDate);
      setPreviewRun(null);
      notify.success(t("accounting.settings.ias29.posted", { amount: run.netMonetaryResult }));
    } catch (error) {
      notify.error(t("accounting.settings.ias29.postFailed"), { description: errorText(error) });
    }
  };

  return {
    settings: current,
    settingsError: settings.isError,
    refetchSettings: settings.refetch,
    settingsDirty: draft !== null,
    savingSettings: saveSettings.isPending,
    update,
    handleSaveSettings,
    indices: indices.data ?? [],
    indicesLoading: indices.isPending,
    indexDate,
    setIndexDate,
    indexValue,
    setIndexValue,
    savingIndex: saveIndices.isPending,
    handleAddIndex,
    restatementDate,
    setRestatementDate: (date: string) => {
      setRestatementDate(date);
      setPreviewRun(null);
    },
    previewRun,
    runs: runs.data ?? [],
    runsLoading: runs.isPending,
    alreadyPosted: (runs.data ?? []).some((run) => run.restatementDate === restatementDate),
    previewing: preview.isPending,
    posting: post.isPending,
    handlePreview,
    handlePost,
  };
}

export type HyperinflationPanel = ReturnType<typeof useHyperinflationPanel>;
