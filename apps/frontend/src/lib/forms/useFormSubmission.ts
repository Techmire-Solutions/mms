import { useCallback, useState } from "react";
import { mapApiFormError } from "@/lib/forms/serverFormErrors";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";

export interface UseFormSubmissionOptions<TData> {
  /**
   * The form's mutation. Must resolve only after the cache invalidation has
   * been triggered (i.e. `mutateAsync`, not `mutate`).
   */
  save: (data: TData) => Promise<unknown>;
  /** Runs after a successful save — usually `onClose`. */
  onSuccess?: () => void | Promise<void>;
  /** Receives the server's field-level messages so the form can render them inline. */
  onFieldErrors?: (errors: Record<string, string>) => void;
  /** Localized copy for a non-field failure (network/500/unknown). */
  fallbackMessage: string;
  /** Localized copy for a 409 (stale token / duplicate conflict). */
  conflictMessage?: string;
  /** Resolves server message keys (e.g. `AppTranslationKey`) to display copy. */
  resolveMessage?: (message: string) => string;
}

export interface UseFormSubmissionResult<TData> {
  /** True while the mutation is in flight — bind to the modal's `saving` prop. */
  submitting: boolean;
  /** Non-field failure shown in the FormModal banner. */
  formError: string | null;
  /** Runs the guarded save. Resolves `true` only when the save and `onSuccess` completed. */
  submit: (data: TData) => Promise<boolean>;
  clearFormError: () => void;
}

/**
 * Single submit path for create/edit forms:
 *
 * 1. synchronous re-entry guard (double click / Enter + click in the same frame),
 * 2. `await save(data)` so the mutation's `onSuccess` invalidators run before close,
 * 3. map contract `errors` onto fields; surface everything else in the banner,
 * 4. close only after the mutation resolved.
 *
 * The form keeps its own draft/error state; this hook owns only the in-flight
 * flag and the form-level fallback message.
 */
export function useFormSubmission<TData>({
  save,
  onSuccess,
  onFieldErrors,
  fallbackMessage,
  conflictMessage,
  resolveMessage,
}: UseFormSubmissionOptions<TData>): UseFormSubmissionResult<TData> {
  const guard = useSubmitGuard();
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const submit = useCallback(
    async (data: TData): Promise<boolean> => {
      const result = await guard(async () => {
        setSubmitting(true);
        setFormError(null);
        try {
          await save(data);
          await onSuccess?.();
          return true;
        } catch (error) {
          const mapped = mapApiFormError(error, resolveMessage);
          if (mapped.fieldErrors) {
            onFieldErrors?.(mapped.fieldErrors);
          }
          const message = mapped.fieldErrors
            ? mapped.message
            : mapped.isConflict
              ? (conflictMessage ?? mapped.message ?? fallbackMessage)
              : (mapped.message ?? fallbackMessage);
          setFormError(message ?? null);
          return false;
        } finally {
          setSubmitting(false);
        }
      });
      return result === true;
    },
    [conflictMessage, fallbackMessage, guard, onFieldErrors, onSuccess, resolveMessage, save],
  );

  const clearFormError = useCallback(() => setFormError(null), []);

  return { submitting, formError, submit, clearFormError };
}
