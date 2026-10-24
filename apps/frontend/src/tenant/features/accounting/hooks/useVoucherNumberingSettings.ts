import { useEffect, useMemo, useState } from "react";
import {
  DEFAULT_VOUCHER_NUMBERING,
  VOUCHER_DELIMITERS,
  VOUCHER_PREFIX_PATTERN,
  voucherFormatKey,
  type SequenceNumberingConfig,
  type VoucherNumbering,
  type VoucherNumberingUpdate,
} from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import {
  useSaveVoucherNumbering,
  useVoucherNumbering,
} from "@/tenant/features/accounting/hooks/useVoucherNumbering";

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

  useEffect(() => {
    if (loaded) setDraft(pickFormat(loaded));
  }, [loaded]);

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
    if (!prefixValid) return;
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
    formatChanged: !!stored && !sameCounter,
    dirty,
    isSaving: save.isPending,
    handleSave,
  };
}
