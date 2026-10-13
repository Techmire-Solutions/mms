import { useEffect, useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { useSessionConfig } from "@/hooks/useStandardModuleConfig";
import { notify } from "@/lib/notify";
import { type Session, SESSION_TYPES } from "@/lib/data/sessionsData";
import { SessionSchema, toTitleCase, type AppTranslationKey } from "@mms/shared";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import type { SessionSelectOption } from "@/tenant/features/sessions/components/SessionFormSections";
import {
  SESSION_CURRENCIES,
  SESSION_STATUSES,
  SESSION_TYPE_LABEL_KEYS,
  buildSessionDraftFromRecord,
  sessionFormDraftSnapshot,
  type SessionFormDraft,
} from "@/tenant/features/sessions/components/sessionFormShared";

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

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sessionDraft, setSessionDraft] = useState<SessionFormDraft>(() =>
    buildSessionDraftFromRecord(session, defaultType, defaultCurrency),
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    sessionFormDraftSnapshot(buildSessionDraftFromRecord(session, defaultType, defaultCurrency)),
  );

  useEffect(() => {
    const nextDraft = buildSessionDraftFromRecord(session, defaultType, defaultCurrency);
    setSessionDraft(nextDraft);
    setBaselineSnapshot(sessionFormDraftSnapshot(nextDraft));
    setErrors({});
  }, [session, defaultCurrency, defaultType]);

  const updateDraft = (patch: Partial<SessionFormDraft>) => {
    setSessionDraft((prev) => ({ ...prev, ...patch }));
  };

  const isDirty = sessionFormDraftSnapshot(sessionDraft) !== baselineSnapshot;

  const handleSave = async (options?: { keepOpen?: boolean }): Promise<boolean> => {
    setErrors({});
    const newErrors: Record<string, string> = {};

    if (!sessionDraft.name?.trim()) {
      newErrors.name = t("sessions.form.nameRequired");
    }
    if (!sessionDraft.startDate) {
      newErrors.startDate = t("sessions.form.startDateRequired");
    }
    if (!sessionDraft.endDate) {
      newErrors.endDate = t("sessions.form.endDateRequired");
    } else if (sessionDraft.startDate && sessionDraft.endDate < sessionDraft.startDate) {
      newErrors.endDate = t("sessions.form.endDateAfterStartDate");
    }
    if (sessionDraft.baseFee && Number(sessionDraft.baseFee) < 0) {
      newErrors.baseFee = t("common.formPleaseFixErrors");
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.error(t("common.formPleaseFixErrors"));
      return false;
    }

    setSaving(true);
    try {
      const payload: Session = {
        id: session?.id || crypto.randomUUID(),
        name: toTitleCase(sessionDraft.name || ""),
        type: sessionDraft.type || defaultType,
        status: (sessionDraft.status as Session["status"]) || "active",
        startDate: sessionDraft.startDate || "",
        endDate: sessionDraft.endDate || "",
        baseFee: Number(sessionDraft.baseFee || 0),
        currency: sessionDraft.currency || defaultCurrency,
        description: sessionDraft.description || "",
        faculty: sessionDraft.faculty || session?.faculty || [],
        classes: sessionDraft.classes || session?.classes || [],
      };

      const parsed = SessionSchema.safeParse(payload);
      if (!parsed.success) {
        setErrors((prev) => ({
          ...prev,
          ...mapZodFormErrors(parsed.error, (message) => t(message as AppTranslationKey)),
        }));
        notify.error(t("common.formPleaseFixErrors"));
        return false;
      }

      await onSave(payload);
      setBaselineSnapshot(sessionFormDraftSnapshot(sessionDraft));
      if (!options?.keepOpen) {
        onClose();
      }
      return true;
    } catch {
      notify.error(t("sessions.toast.saveFailed"));
      return false;
    } finally {
      setSaving(false);
    }
  };

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
    saving,
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
