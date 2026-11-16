import { useCallback, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { notify } from "@/lib/notify";
import { isApiError } from "@/lib/apiError";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { mapApiFormError } from "@/lib/forms/serverFormErrors";
import { toValidationErrors, type ValidationError } from "@/lib/forms/validationErrors";

export interface UseZodDraftFormOptions<TDraft extends object, TRecord> {
  schema: z.ZodType<TRecord>;
  /** Maps the editable draft to the domain record the schema validates. */
  toRecord: (draft: TDraft) => TRecord;
  /** Resolves message keys (often AppTranslationKeys) to display copy. */
  resolveMessage: (message: string) => string;
  /** Cheap pre-schema checks: field → first error message. */
  earlyRules?: (draft: TDraft) => Record<string, string>;
  /** Dirty-tracking snapshot (defaults to JSON.stringify). */
  snapshot?: (draft: TDraft) => string;
  /** Message used for the generic "fix errors" notification. */
  notifyFallbackMessage?: string;
  /** Resolved message used when `onSave` throws. */
  saveFailedMessage?: string;
}

export interface UseZodDraftFormApi<TDraft, TRecord> {
  draft: TDraft;
  updateDraft: (patch: Partial<TDraft>) => void;
  /** Replaces the draft and re-baselines its snapshot (external record change). */
  resetDraft: (nextDraft: TDraft) => void;
  isDirty: boolean;
  /** First-issue-per-field display errors. */
  errors: Record<string, string>;
  /** Issue list in the shared `ValidationError[]` contract (incl. `tabId`). */
  validationErrors: ValidationError[];
  /** Form-level message returned by the API when no field mapping is available. */
  serverError: string | null;
  isSaving: boolean;
  /** Validates early rules + schema, calls `onSave(record)`, re-baselines on success. */
  save: (onSave: (record: TRecord) => void | Promise<void>) => Promise<boolean>;
}

/**
 * Shared draft-form state machine for the hand-rolled form stack:
 * early rules → Zod schema validation → save with notification + dirty
 * baseline. Mirrors `useSessionFormController` 1:1; all phrasing goes through
 * `resolveMessage` so callers keep their own `t()`.
 */
export function useZodDraftForm<TDraft extends object, TRecord>(
  initialDraft: TDraft,
  options: UseZodDraftFormOptions<TDraft, TRecord>,
): UseZodDraftFormApi<TDraft, TRecord> {
  const {
    schema,
    toRecord,
    resolveMessage,
    earlyRules,
    snapshot: snapshotDraft,
    notifyFallbackMessage = "common.formPleaseFixErrors",
    saveFailedMessage,
  } = options;
  const takeSnapshot = useCallback(
    (draft: TDraft): string => (snapshotDraft ? snapshotDraft(draft) : JSON.stringify(draft)),
    [snapshotDraft],
  );

  const [draft, setDraft] = useState<TDraft>(initialDraft);
  const [baseline, setBaseline] = useState(() => takeSnapshot(initialDraft));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<ValidationError[]>([]);
  const [serverError, setServerError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const updateDraft = useCallback((patch: Partial<TDraft>) => {
    setDraft((prev) => ({ ...prev, ...patch }));
    setServerError(null);
  }, []);

  const resetDraft = useCallback(
    (nextDraft: TDraft) => {
      setDraft(nextDraft);
      setBaseline(takeSnapshot(nextDraft));
      setErrors({});
      setValidationErrors([]);
      setServerError(null);
    },
    [takeSnapshot],
  );

  const isDirty = useMemo(() => takeSnapshot(draft) !== baseline, [draft, baseline, takeSnapshot]);

  const applyFailure = useCallback(
    (parsedErrors: Record<string, string>, parsedValidationErrors: ValidationError[]) => {
      setErrors(parsedErrors);
      setValidationErrors(parsedValidationErrors);
      notify.error(resolveMessage(notifyFallbackMessage));
    },
    [notifyFallbackMessage, resolveMessage],
  );

  const performSave = useCallback<UseZodDraftFormApi<TDraft, TRecord>["save"]>(
    async (onSave) => {
      setErrors({});
      setValidationErrors([]);
      setServerError(null);

      const newErrors: Record<string, string> = earlyRules ? earlyRules(draft) : {};
      if (Object.keys(newErrors).length > 0) {
        applyFailure(newErrors, []);
        return false;
      }

      setIsSaving(true);
      try {
        const parsed = schema.safeParse(toRecord(draft));
        if (!parsed.success) {
          applyFailure(
            mapZodFormErrors(parsed.error, resolveMessage),
            toValidationErrors(parsed.error, { resolveMessage }),
          );
          return false;
        }

        await onSave(parsed.data);
        setBaseline(takeSnapshot(draft));
        return true;
      } catch (error) {
        // Server-side validation must be visible in the form, not swallowed by a generic toast.
        const mapped = mapApiFormError(error, resolveMessage);
        if (mapped.fieldErrors) {
          setErrors(mapped.fieldErrors);
          setValidationErrors(
            Object.entries(mapped.fieldErrors).map(([fieldId, message]) => ({
              fieldId,
              tabId: "basic",
              message,
            })),
          );
        }
        if (mapped.message) setServerError(mapped.message);
        if (!mapped.fieldErrors && !isApiError(error)) {
          notify.error(
            saveFailedMessage
              ? resolveMessage(saveFailedMessage)
              : resolveMessage(notifyFallbackMessage),
          );
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      applyFailure,
      draft,
      earlyRules,
      notifyFallbackMessage,
      resolveMessage,
      saveFailedMessage,
      schema,
      takeSnapshot,
      toRecord,
    ],
  );

  // Setters from state re-render too late to stop a same-frame double submit, and
  // `toRecord` mints a fresh entity id per invocation — the ref is the guard.
  const inFlightRef = useRef(false);
  const save = useCallback<UseZodDraftFormApi<TDraft, TRecord>["save"]>(
    async (onSave) => {
      if (inFlightRef.current) return false;
      inFlightRef.current = true;
      try {
        return await performSave(onSave);
      } finally {
        inFlightRef.current = false;
      }
    },
    [performSave],
  );

  return {
    draft,
    updateDraft,
    resetDraft,
    isDirty,
    errors,
    validationErrors,
    serverError,
    isSaving,
    save,
  };
}
