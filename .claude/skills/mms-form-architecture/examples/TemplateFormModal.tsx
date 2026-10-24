import React, { useState, useEffect } from "react";
import { FormModal } from "@/components/app/FormModal";
import { Input } from "@shared/ui";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { z } from "zod";

const templateItemSchema = z.object({
  name: z.string().min(1, "Name is required"),
  code: z.string().min(1, "Code is required"),
  notes: z.string().optional(),
}).strict();

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
 * 4. React 19 ref-as-prop and accessible form controls.
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
        {errors.form && (
          <div className="p-3 text-sm text-rose-600 bg-rose-50 dark:bg-rose-950/50 rounded border border-rose-200 dark:border-rose-800">
            {errors.form}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="template-item-name">
            Name
          </label>
          <Input
            id="template-item-name"
            value={draft.name}
            onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
            aria-invalid={Boolean(errors.name)}
          />
          {errors.name && <p className="text-xs text-rose-500 mt-1">{errors.name}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium mb-1" htmlFor="template-item-code">
            Code
          </label>
          <Input
            id="template-item-code"
            value={draft.code}
            onChange={(e) => setDraft((d) => ({ ...d, code: e.target.value }))}
            aria-invalid={Boolean(errors.code)}
          />
          {errors.code && <p className="text-xs text-rose-500 mt-1">{errors.code}</p>}
        </div>
      </div>
    </FormModal>
  );
}
