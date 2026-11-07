import { useCallback, useMemo, useState } from "react";
import type { z } from "zod";
import { notify } from "@/lib/notify";
import { isApiError } from "@/lib/apiError";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
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

/** Maps common API validation error payloads to field → message entries. */
function mapApiFormError(error: unknown): {
  fieldErrors?: Record<string, string>;
  message?: string;
} {
  if (!isApiError(error)) return {};
  const raw = error.errors;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const record = raw as Record<string, unknown>;
    const source =
      record.fieldErrors && typeof record.fieldErrors === "object"
        ? (record.fieldErrors as Record<string, unknown>)
        : record;
    const fieldErrors: Record<string, string> = {};
    for (const [key, value] of Object.entries(source)) {
      if (typeof value === "string") fieldErrors[key] = value;
      else if (Array.isArray(value) && typeof value[0] === "string")
        fieldErrors[key] = String(value[0]);
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { fieldErrors, message: error.message };
    }
  }
  if (Array.isArray(raw)) {
    const fieldErrors: Record<string, string> = {};
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const entry = item as { field?: unknown; path?: unknown; message?: unknown };
      const field = typeof entry.field === "string" ? entry.field : String(entry.path ?? []);
      if (field && typeof entry.message === "string") fieldErrors[field] = entry.message;
    }
    if (Object.keys(fieldErrors).length > 0) return { fieldErrors, message: error.message };
  }
  return { message: error.message };
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

  const save = useCallback<UseZodDraftFormApi<TDraft, TRecord>["save"]>(
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
        const mapped = mapApiFormError(error);
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
