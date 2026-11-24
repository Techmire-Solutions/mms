import React, { useState } from "react";
import { z } from "zod";
import type { AppTranslationKey } from "@mms/contracts";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { Input } from "@mms/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { translateValidationMessage } from "@/lib/forms/translateValidationMessage";
import { useDirtySnapshot } from "@/lib/forms/useDirtySnapshot";
import { useFormSubmission } from "@/lib/forms/useFormSubmission";
import { useIdentityReset } from "@/lib/forms/useIdentityReset";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";

/**
 * Standard Production Template for an MMS FormModal.
 *
 * Demonstrates the full `mms-form-architecture.md` §2 contract:
 *
 * 1. One strict Zod write schema, validated on submit (never while typing).
 * 2. Identity-based reset — switching record or reopening never inherits the
 *    previous draft (`useIdentityReset`).
 * 3. Dirty tracking (`useDirtySnapshot`) wired to the shell's discard confirm. The
 *    reset value is passed as the baseline because the reset is scheduled during
 *    render; without it the first edit-open would look dirty.
 * 4. One guarded submit path (`useFormSubmission`): synchronous double-submit
 *    guard, `saving={submitting}`, await-before-close, field-level server errors
 *    mapped onto the same keys as the Zod errors, non-field failures in the shell
 *    banner via `error`.
 * 5. `Field` owns label / required mark / hint / inline error and wires
 *    `aria-invalid` + `aria-describedby` on the control.
 *
 * The shell contract is `open`, `onSave`, `saving`, `saveDisabled`, `error`,
 * `isDirty` — there is no `isOpen`, `isSubmitting`, or `onSubmit` prop.
 *
 * Copy: `labels` carries the module's own `AppTranslationKey`s, so the component
 * type-checks against the real key union and cannot ship an invented key. A
 * concrete form usually hardcodes its module's keys instead of taking props.
 */

const templateItemSchema = z
  .object({
    name: z.string().trim().min(1, "validation.required"),
    code: z.string().trim().min(1, "validation.required"),
    notes: z.string().optional(),
  })
  .strict();

type TemplateItemFormData = z.infer<typeof templateItemSchema>;

const EMPTY_DRAFT: TemplateItemFormData = { name: "", code: "", notes: "" };

export interface TemplateFormLabels {
  titleCreate: AppTranslationKey;
  titleEdit: AppTranslationKey;
  name: AppTranslationKey;
  code: AppTranslationKey;
  notes: AppTranslationKey;
  nameHint: AppTranslationKey;
}

interface TemplateFormModalProps {
  open: boolean;
  /** Identity of the record being edited — `null`/omitted means "create". */
  recordId?: string | null;
  initialData?: TemplateItemFormData | null;
  /** Module copy keys (all four locale packs). */
  labels: TemplateFormLabels;
  onClose: () => void;
  /** Must resolve only after the mutation's invalidators have run. */
  onSave: (data: TemplateItemFormData) => Promise<void>;
}

export function TemplateFormModal({
  open,
  recordId = null,
  initialData,
  labels,
  onClose,
  onSave,
}: TemplateFormModalProps): React.JSX.Element {
  const { t } = useTranslation();
  const [draft, setDraft] = useState<TemplateItemFormData>(EMPTY_DRAFT);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // The value the reset produces; also the dirty baseline (see step 3 above).
  const resetDraft = initialData ?? EMPTY_DRAFT;

  // Identity drives every reset: open/close and record switches.
  const identity = `${open ? "open" : "closed"}:${recordId ?? "new"}`;

  useIdentityReset(identity, () => {
    setDraft(resetDraft);
    setErrors({});
  });

  const { isDirty } = useDirtySnapshot(draft, identity, resetDraft);

  const { submitting, formError, submit } = useFormSubmission<TemplateItemFormData>({
    save: onSave,
    onSuccess: onClose,
    onFieldErrors: setErrors,
    fallbackMessage: t("errors.state.generic"),
    resolveMessage: (message) => translateValidationMessage(message, t),
  });

  const patch = (value: Partial<TemplateItemFormData>) =>
    setDraft((current) => ({ ...current, ...value }));

  const handleSubmit = async () => {
    const parsed = templateItemSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(mapZodFormErrors(parsed.error, (message) => translateValidationMessage(message, t)));
      return;
    }
    setErrors({});
    await submit(parsed.data);
  };

  return (
    <FormModal
      open={open}
      title={t(recordId ? labels.titleEdit : labels.titleCreate)}
      onClose={onClose}
      onSave={handleSubmit}
      saving={submitting}
      isDirty={isDirty}
      error={formError ?? undefined}
      saveOnTabChange={false}
    >
      <div className="space-y-3">
        <Field
          id="template-item-name"
          label={t(labels.name)}
          required
          hint={t(labels.nameHint)}
          error={errors.name}
        >
          <Input
            id="template-item-name"
            value={draft.name}
            onChange={(event) => patch({ name: event.target.value })}
            autoComplete="off"
          />
        </Field>

        <Field id="template-item-code" label={t(labels.code)} required error={errors.code}>
          <Input
            id="template-item-code"
            value={draft.code}
            onChange={(event) => patch({ code: event.target.value })}
            autoComplete="off"
          />
        </Field>

        <Field id="template-item-notes" label={t(labels.notes)} error={errors.notes}>
          <Input
            id="template-item-notes"
            value={draft.notes ?? ""}
            onChange={(event) => patch({ notes: event.target.value })}
          />
        </Field>
      </div>
    </FormModal>
  );
}
