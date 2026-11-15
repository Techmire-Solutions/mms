import React, { useEffect, useState } from "react";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { FormErrorBanner } from "@/components/app/FormErrorBanner";
import { Input } from "@shared/ui";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { z } from "zod";

const templateItemSchema = z
  .object({
    name: z.string().min(1, "Name is required"),
    code: z.string().min(1, "Code is required"),
    notes: z.string().optional(),
  })
  .strict();

type TemplateItemFormData = z.infer<typeof templateItemSchema>;

interface TemplateFormModalProps {
  open: boolean;
  initialData?: TemplateItemFormData | null;
  onClose: () => void;
  onSave: (data: TemplateItemFormData) => Promise<void>;
}

/**
 * Standard Production Template for an MMS FormModal.
 *
 * Demonstrates:
 * 1. Strict Zod schema validation on submit.
 * 2. `mapZodFormErrors` error transformation.
 * 3. Draft preservation and reset on opener switch.
 * 4. `Field` label/required/hint/error chrome, `FormErrorBanner` summary,
 *    and the default `FormModalFooter` (Cancel start, primary submit end).
 */
export function TemplateFormModal({
  open,
  initialData,
  onClose,
  onSave,
}: TemplateFormModalProps) {
  const [draft, setDraft] = useState<TemplateItemFormData>({
    name: "",
    code: "",
    notes: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setDraft(initialData);
    } else {
      setDraft({ name: "", code: "", notes: "" });
    }
    setErrors({});
  }, [initialData, open]);

  const handleSubmit = async () => {
    const parsed = templateItemSchema.safeParse(draft);
    if (!parsed.success) {
      setErrors(mapZodFormErrors(parsed.error, (msg) => msg));
      return;
    }

    setSaving(true);
    try {
      await onSave(parsed.data);
      onClose();
    } catch (err) {
      setErrors({ form: err instanceof Error ? err.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  const formErrors = errors.form ? [errors.form] : [];

  return (
    <FormModal
      open={open}
      title={initialData ? "Edit Item" : "Create Item"}
      onClose={onClose}
      onSave={handleSubmit}
      saving={saving}
      saveDisabled={saving}
      saveOnTabChange={false}
    >
      <div className="space-y-4">
        <FormErrorBanner errors={formErrors} />

        <Field id="template-item-name" label="Name" required error={errors.name}>
          <Input
            id="template-item-name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          />
        </Field>

        <Field
          id="template-item-code"
          label="Code"
          required
          hint="Unique short code shown in lists."
          error={errors.code}
        >
          <Input
            id="template-item-code"
            value={draft.code}
            onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
          />
        </Field>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field id="template-item-notes" label="Notes">
            <Input
              id="template-item-notes"
              value={draft.notes ?? ""}
              onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
            />
          </Field>
        </div>
      </div>
    </FormModal>
  );
}
