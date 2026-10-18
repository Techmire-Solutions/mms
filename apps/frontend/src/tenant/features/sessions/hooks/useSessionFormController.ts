import { useCallback, useEffect, useMemo } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { useFinanceCurrency } from "@/hooks/useCurrency";
import { type Session } from "@/lib/data/sessionsData";
import {
  DEFAULT_SESSION_CATEGORY_CODE,
  SESSIONS_MODULE_MANIFEST,
  SESSION_TRANSITIONS,
  SessionSchema,
  isSessionStructureLocked,
  normalizeSessionStatus,
  toTitleCase,
  type AppTranslationKey,
  type SessionLifecycleState,
} from "@mms/shared";
import { useAcademicCatalogItems } from "@/hooks/useAcademicCatalog";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { useZodDraftForm } from "@/lib/forms/useZodDraftForm";
import type { SessionSelectOption } from "@/tenant/features/sessions/components/SessionFormSections";
import {
  SESSION_CURRENCIES,
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
  const { activeCurrency } = useFinanceCurrency();
  const defaultCurrency = activeCurrency.code;

  // Lifecycle: new sessions start as draft/open; existing ones offer only allowed transitions.
  const currentStatus = normalizeSessionStatus(session?.status ?? "draft");
  const statusValues: SessionLifecycleState[] = session
    ? [currentStatus, ...SESSION_TRANSITIONS[currentStatus]]
    : ["draft", "open"];
  const structureLocked = Boolean(session) && isSessionStructureLocked(currentStatus);
  const { canEditSetup } = useModulePermissions(SESSIONS_MODULE_MANIFEST);
  const categories = useAcademicCatalogItems("categories").data ?? [];
  const defaultCategoryId =
    categories.find((row) => row.code === DEFAULT_SESSION_CATEGORY_CODE && !row.deletedAt)?.id ??
    "";

  const buildDraft = useCallback(
    () => buildSessionDraftFromRecord(session, defaultCurrency),
    [session, defaultCurrency],
  );

  const form = useZodDraftForm<SessionFormDraft, Session>(useMemo(buildDraft, [buildDraft]), {
    schema: SessionSchema,
    toRecord: (draft): Session => ({
      id: session?.id || crypto.randomUUID(),
      name: toTitleCase(draft.name || ""),
      // Category/program are catalog ids; the server resolves defaults and the `type` snapshot.
      type: session?.type ?? "",
      categoryId: draft.categoryId || defaultCategoryId,
      programId: draft.programId || "",
      status: (draft.status as Session["status"]) || currentStatus,
      startDate: draft.startDate || "",
      endDate: draft.endDate || "",
      workingDays: draft.workingDays ?? [],
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

  const statusOptions: SessionSelectOption[] = statusValues.map((state) => ({
    value: state,
    label: t(`sessions.lifecycle.${state}`),
  }));

  return {
    t,
    language,
    defaultCurrency,
    saving: isSaving,
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
