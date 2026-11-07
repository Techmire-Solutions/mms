import { useCallback, useEffect, useMemo, useRef } from "react";
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
  // Cancelling stays on the dedicated action (it records a reason and ends enrollments), so the
  // form never offers `cancelled` as a plain status change.
  const currentStatus = normalizeSessionStatus(session?.status ?? "draft");
  const statusValues: SessionLifecycleState[] = session
    ? [
        currentStatus,
        ...SESSION_TRANSITIONS[currentStatus].filter((state) => state !== "cancelled"),
      ]
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
      // OCC token: without it the server cannot reject a stale edit (silent overwrite).
      updatedAt: session?.updatedAt,
      name: (draft.name || "").trim(),
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
      minAttendancePct: draft.minAttendancePct ? Number(draft.minAttendancePct) : null,
      requiresExamPass: draft.requiresExamPass ?? false,
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
      if (draft.minAttendancePct && Number(draft.minAttendancePct) > 100) {
        newErrors.minAttendancePct = t("sessions.completion.minAttendanceInvalid");
      }
      return newErrors;
    },
    saveFailedMessage: "sessions.toast.saveFailed",
  });
  const {
    draft: sessionDraft,
    updateDraft,
    resetDraft,
    isDirty,
    isSaving,
    errors,
    serverError,
    save,
  } = form;

  // Reset only when the edited session identity changes, or when async defaults arrive while the
  // form is pristine. A detail refetch/live push creates a new object with the same id and must not
  // wipe a dirty draft.
  const lastSessionIdRef = useRef(session?.id ?? null);
  const lastDefaultsRef = useRef(`${defaultCategoryId}|${defaultCurrency}`);
  useEffect(() => {
    const nextId = session?.id ?? null;
    const nextDefaults = `${defaultCategoryId}|${defaultCurrency}`;
    if (lastSessionIdRef.current !== nextId) {
      lastSessionIdRef.current = nextId;
      lastDefaultsRef.current = nextDefaults;
      resetDraft(buildDraft());
      return;
    }
    if (lastDefaultsRef.current !== nextDefaults) {
      lastDefaultsRef.current = nextDefaults;
      if (!isDirty && !isSaving) resetDraft(buildDraft());
    }
  }, [session?.id, defaultCategoryId, defaultCurrency, isDirty, isSaving, buildDraft, resetDraft]);

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
    serverError,
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
