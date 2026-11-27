import { useMemo, useState } from "react";
import {
  DEFAULT_VOUCHER_NUMBERING,
  VOUCHER_DELIMITERS,
  VOUCHER_PREFIX_PATTERN,
  voucherFormatKey,
  type SequenceNumberingConfig,
  type VoucherNumbering,
  type VoucherNumberingUpdate,
  voucherNumberingUpdateSchema,
} from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { notify } from "@mms/fe-core/notify";
import { useSaveVoucherNumbering, useVoucherNumbering } from "./useVoucherNumbering";

const isDelimiter = (value: string): value is VoucherNumberingUpdate["delimiter"] =>
  (VOUCHER_DELIMITERS as readonly string[]).includes(value);

function pickFormat(source: VoucherNumbering | VoucherNumberingUpdate): VoucherNumberingUpdate {
  const {
    autoGenerate,
    prefix,
    delimiter,
    yearFormat,
    sequenceDigits,
    startingSequence,
    rolloverPolicy,
  } = source;
  return {
    autoGenerate,
    prefix,
    delimiter,
    yearFormat,
    sequenceDigits,
    startingSequence,
    rolloverPolicy,
  };
}

/** Draft, validation and save for the Setup → journal voucher numbering card. */
export function useVoucherNumberingSettings() {
  const { t } = useTranslation();
  const { data: loaded } = useVoucherNumbering();
  const save = useSaveVoucherNumbering();
  const [draft, setDraft] = useState<VoucherNumberingUpdate>(() =>
    loaded ? pickFormat(loaded) : DEFAULT_VOUCHER_NUMBERING,
  );
  const [error, setError] = useState<string | null>(null);

  // Re-seed the draft when a new server config arrives, during render.
  const loadedKey = loaded ? JSON.stringify(pickFormat(loaded)) : "";
  const [prevLoadedKey, setPrevLoadedKey] = useState(loadedKey);
  if (prevLoadedKey !== loadedKey) {
    setPrevLoadedKey(loadedKey);
    if (loaded) setDraft(pickFormat(loaded));
  }

  const stored = loaded ? pickFormat(loaded) : null;
  const dirty =
    !!stored &&
    (Object.keys(draft) as (keyof VoucherNumberingUpdate)[]).some(
      (key) => draft[key] !== stored[key],
    );
  const prefixValid = VOUCHER_PREFIX_PATTERN.test(draft.prefix);
  // A changed format or period rule starts a different counter, seeded server-side on first use.
  const sameCounter =
    !!stored &&
    voucherFormatKey(stored) === voucherFormatKey(draft) &&
    stored.rolloverPolicy === draft.rolloverPolicy;

  const cardConfig = useMemo<SequenceNumberingConfig>(
    () => ({
      ...draft,
      currentSequence: sameCounter && loaded ? loaded.currentSequence : 0,
      ...(loaded && loaded.periodYear > 0 ? { lastRolloverYear: loaded.periodYear } : {}),
    }),
    [draft, loaded, sameCounter],
  );

  /** The shared card edits a looser shape; keep the stored format valid as it changes. */
  const handleCardChange = (next: SequenceNumberingConfig) => {
    setError(null);
    const restarts = next.rolloverPolicy !== "never";
    setDraft({
      autoGenerate: next.autoGenerate,
      prefix: next.prefix.trim().toUpperCase(),
      delimiter: isDelimiter(next.delimiter) ? next.delimiter : draft.delimiter,
      // Restarting without printing the year would reissue last year's numbers.
      yearFormat: restarts && next.yearFormat === "NONE" ? "YYYY" : next.yearFormat,
      sequenceDigits: next.sequenceDigits,
      startingSequence: next.startingSequence,
      rolloverPolicy: next.rolloverPolicy,
    });
  };

  const handleSave = async (): Promise<void> => {
    const parsed = voucherNumberingUpdateSchema.safeParse(draft);
    if (!prefixValid || !parsed.success) {
      setError(t("accounting.settings.voucher.invalid"));
      return;
    }
    setError(null);
    try {
      await save.mutateAsync(draft);
      notify.success(t("accounting.settings.voucher.saved"));
    } catch (error) {
      notify.error(t("accounting.settings.voucher.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    cardConfig,
    handleCardChange,
    prefixValid,
    error,
    formatChanged: !!stored && !sameCounter,
    dirty,
    isSaving: save.isPending,
    handleSave,
  };
}
