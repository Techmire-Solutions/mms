import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useSessionConfig } from "@/hooks/useStandardModuleConfig";
import { type Session, SESSION_TYPES } from "@/lib/data/sessionsData";
import { SessionSchema, toTitleCase, type AppTranslationKey } from "@mms/shared";
import { useZodDraftForm } from "@/lib/forms/useZodDraftForm";
import type { SessionSelectOption } from "@/tenant/features/sessions/components/SessionFormSections";
import {
  SESSION_CURRENCIES,
  SESSION_STATUSES,
  SESSION_TYPE_LABEL_KEYS,
  buildSessionDraftFromRecord,
  sessionFormDraftSnapshot,
  type SessionFormDraft,
} from "@/tenant/features/sessions/lib/sessionFormShared";

export interface UseSessionFormControllerProps {
  session?: Session | null;
  onClose: () => void;
  onSave: (session: Session) => void | Promise<void>;
}

export function useSessionFormController({
  session,
  onClose,
  onSave,
}: UseSessionFormControllerProps) {
  const { t } = useTranslation();
  const { language } = useGlobalSettings();
  const { settings, types, statuses } = useSessionConfig();
  const { activeCurrency } = useFinanceCurrency();
  const defaultCurrency = activeCurrency.code;

  const typeOptions = types.length > 0 ? types : [...SESSION_TYPES];
  const statusValues = statuses.length > 0 ? statuses : [...SESSION_STATUSES];
  const defaultType = typeOptions.includes(settings.defaultSessionType)
    ? settings.defaultSessionType
    : typeOptions[0] || "Hifz";

  const buildDraft = useCallback(
    () => buildSessionDraftFromRecord(session, defaultType, defaultCurrency),
    [session, defaultType, defaultCurrency],
  );

  const form = useZodDraftForm<SessionFormDraft, Session>(useMemo(buildDraft, [buildDraft]), {
    schema: SessionSchema,
    toRecord: (draft): Session => ({
      id: session?.id || crypto.randomUUID(),
      name: toTitleCase(draft.name || ""),
      type: draft.type || defaultType,
      status: (draft.status as Session["status"]) || "active",
      startDate: draft.startDate || "",
      endDate: draft.endDate || "",
      baseFee: Number(draft.baseFee || 0),
      currency: draft.currency || defaultCurrency,
      description: draft.description || "",
      faculty: draft.faculty || session?.faculty || [],
      classes: draft.classes || session?.classes || [],
    }),
    resolveMessage: (message) => t(message as AppTranslationKey),
    snapshot: sessionFormDraftSnapshot,
    earlyRules: (draft) => {
      const newErrors: Record<string, string> = {};
      if (!draft.name?.trim()) {
        newErrors.name = t("sessions.form.nameRequired");
      }
      if (!draft.startDate) {
        newErrors.startDate = t("sessions.form.startDateRequired");
      }
      if (!draft.endDate) {
        newErrors.endDate = t("sessions.form.endDateRequired");
      } else if (draft.startDate && draft.endDate < draft.startDate) {
        newErrors.endDate = t("sessions.form.endDateAfterStartDate");
      }
      if (draft.baseFee && Number(draft.baseFee) < 0) {
        newErrors.baseFee = t("common.formPleaseFixErrors");
      }
      return newErrors;
    },
    saveFailedMessage: "sessions.toast.saveFailed",
  });
  const { draft: sessionDraft, updateDraft, resetDraft, isDirty, isSaving, errors, save } = form;

  useEffect(() => {
    resetDraft(buildDraft());
  }, [buildDraft, resetDraft]);

  const handleSave = useCallback(
    async (options?: { keepOpen?: boolean }): Promise<boolean> => {
      return save(async (payload: Session) => {
        await onSave(payload);
        if (!options?.keepOpen) {
          onClose();
        }
      });
    },
    [onClose, onSave, save],
  );

  const sessionTypeOptions = ((): SessionSelectOption[] =>
    typeOptions.map((typeOption) => {
      const translationKey = SESSION_TYPE_LABEL_KEYS[typeOption];
      return {
        value: typeOption,
        label: translationKey ? t(translationKey) : typeOption,
      };
    }))();

  const statusOptions = ((): SessionSelectOption[] =>
    statusValues.map((statusOption) => {
      const translationKey = `sessions.statuses.${statusOption}` as AppTranslationKey;
      const translated = t(translationKey);
      const label = translated === translationKey ? toTitleCase(statusOption) : translated;
      return { value: statusOption, label };
    }))();

  return {
    t,
    language,
    defaultType,
    defaultCurrency,
    saving: isSaving,
    errors,
    sessionDraft,
    updateDraft,
    isDirty,
    handleSave,
    sessionTypeOptions,
    statusOptions,
    currencyOptions: SESSION_CURRENCIES,
  };
}
