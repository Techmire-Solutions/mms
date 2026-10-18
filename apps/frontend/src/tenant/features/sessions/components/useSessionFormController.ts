import { useEffect, useState } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import { useGlobalSettings } from '@/tenant/hooks/useGlobalSettings';
import { useFinanceCurrency } from '@/hooks/useCurrency';
import { notify } from '@/lib/notify';
import { type Session } from '@/lib/data/sessionsData';
import {
  DEFAULT_SESSION_CATEGORY_CODE, SESSIONS_MODULE_MANIFEST, SESSION_TRANSITIONS, SessionSchema, isSessionStructureLocked,
  normalizeSessionStatus, toTitleCase, type AppTranslationKey, type SessionLifecycleState,
} from '@mms/shared';
import { useAcademicCatalogItems } from '@/hooks/useAcademicCatalog';
import { useModulePermissions } from '@/tenant/hooks/usePermissions';
import { mapZodFormErrors } from '@/lib/forms/mapZodFormErrors';
import type { SessionSelectOption } from '@/tenant/features/sessions/components/SessionFormSections';
import {
  SESSION_CURRENCIES,
  buildSessionDraftFromRecord,
  sessionFormDraftSnapshot,
  type SessionFormDraft,
} from '@/tenant/features/sessions/components/sessionFormShared';

export interface UseSessionFormControllerProps {
  session?: Session | null;
  onClose: () => void;
  onSave: (session: Session) => void | Promise<void>;
}

export function useSessionFormController({ session, onClose, onSave }: UseSessionFormControllerProps) {
  const { t } = useTranslation();
  const { language } = useGlobalSettings();
  const { activeCurrency } = useFinanceCurrency();
  const defaultCurrency = activeCurrency.code;

  // Lifecycle: new sessions start as draft/open; existing ones offer only allowed transitions.
  const currentStatus = normalizeSessionStatus(session?.status ?? 'draft');
  const statusValues: SessionLifecycleState[] = session ? [currentStatus, ...SESSION_TRANSITIONS[currentStatus]] : ['draft', 'open'];
  const structureLocked = Boolean(session) && isSessionStructureLocked(currentStatus);
  const { canEditSetup } = useModulePermissions(SESSIONS_MODULE_MANIFEST);
  const categories = useAcademicCatalogItems('categories').data ?? [];
  const defaultCategoryId = categories.find((row) => row.code === DEFAULT_SESSION_CATEGORY_CODE && !row.deletedAt)?.id ?? '';

  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sessionDraft, setSessionDraft] = useState<SessionFormDraft>(() =>
    buildSessionDraftFromRecord(session, defaultCurrency),
  );
  const [baselineSnapshot, setBaselineSnapshot] = useState(() =>
    sessionFormDraftSnapshot(buildSessionDraftFromRecord(session, defaultCurrency)),
  );

  useEffect(() => {
    const nextDraft = buildSessionDraftFromRecord(session, defaultCurrency);
    setSessionDraft(nextDraft);
    setBaselineSnapshot(sessionFormDraftSnapshot(nextDraft));
    setErrors({});
  }, [session, defaultCurrency]);

  const updateDraft = (patch: Partial<SessionFormDraft>) => {
    setSessionDraft((prev) => ({ ...prev, ...patch }));
  };

  const isDirty = sessionFormDraftSnapshot(sessionDraft) !== baselineSnapshot;

  const handleSave = async (options?: { keepOpen?: boolean }): Promise<boolean> => {
    setErrors({});
    const newErrors: Record<string, string> = {};

    if (!sessionDraft.name?.trim()) {
      newErrors.name = t('sessions.form.nameRequired');
    }
    if (!sessionDraft.startDate) {
      newErrors.startDate = t('sessions.form.startDateRequired');
    }
    if (!sessionDraft.endDate) {
      newErrors.endDate = t('sessions.form.endDateRequired');
    } else if (sessionDraft.startDate && sessionDraft.endDate < sessionDraft.startDate) {
      newErrors.endDate = t('sessions.form.endDateAfterStartDate');
    }
    if (sessionDraft.baseFee && Number(sessionDraft.baseFee) < 0) {
      newErrors.baseFee = t('common.formPleaseFixErrors');
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      notify.error(t('common.formPleaseFixErrors'));
      return false;
    }

    setSaving(true);
    try {
      const payload: Session = {
        id: session?.id || crypto.randomUUID(),
        name: toTitleCase(sessionDraft.name || ''),
        // Category/program are catalog ids; the server resolves defaults and the `type` snapshot.
        type: session?.type ?? '',
        categoryId: sessionDraft.categoryId || defaultCategoryId,
        programId: sessionDraft.programId || '',
        status: (sessionDraft.status as Session['status']) || currentStatus,
        startDate: sessionDraft.startDate || '',
        endDate: sessionDraft.endDate || '',
        workingDays: sessionDraft.workingDays ?? [],
        baseFee: Number(sessionDraft.baseFee || 0),
        currency: sessionDraft.currency || defaultCurrency,
        description: sessionDraft.description || '',
        faculty: sessionDraft.faculty || session?.faculty || [],
        classes: sessionDraft.classes || session?.classes || [],
      };

      const parsed = SessionSchema.safeParse(payload);
      if (!parsed.success) {
        setErrors((prev) => ({
          ...prev,
          ...mapZodFormErrors(parsed.error, (message) => t(message as AppTranslationKey)),
        }));
        notify.error(t('common.formPleaseFixErrors'));
        return false;
      }

      await onSave(payload);
      setBaselineSnapshot(sessionFormDraftSnapshot(sessionDraft));
      if (!options?.keepOpen) {
        onClose();
      }
      return true;
    } catch {
      notify.error(t('sessions.toast.saveFailed'));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const statusOptions: SessionSelectOption[] = statusValues.map((state) => ({ value: state, label: t(`sessions.lifecycle.${state}`) }));

  return {
    t,
    language,
    defaultCurrency,
    saving,
    errors,
    sessionDraft,
    updateDraft,
    isDirty,
    handleSave,
    statusOptions,
    structureLocked,
    defaultCategoryId,
    canCreateCatalog: canEditSetup,
    currencyOptions: SESSION_CURRENCIES,
  };
}
