import type React from "react";
import { useState } from "react";
import { Tag } from "lucide-react";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { FORM_INPUT } from "@/components/ui/formStyles";

export interface ContactsBulkTagModalProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onConfirm: (tags: string[]) => Promise<void> | void;
  isPending?: boolean;
}

export function ContactsBulkTagModal({
  open,
  onClose,
  selectedCount,
  onConfirm,
  isPending = false,
}: ContactsBulkTagModalProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const [tagInput, setTagInput] = useState("");

  if (!open) return null;

  const handleSave = async () => {
    const tags = tagInput
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    if (tags.length === 0) return;
    await onConfirm(tags);
    setTagInput("");
    onClose();
  };

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t("contacts.bulkTagTitle")}
      icon={Tag}
      size="sm"
      cancelLabel={t("common.cancel")}
      saveLabel={t("contacts.bulkTagAdd")}
      onSave={handleSave}
      saving={isPending}
      saveDisabled={isPending || tagInput.trim().length === 0}
      formId="bulk-tag-form"
    >
      <form
        id="bulk-tag-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!isPending && tagInput.trim().length > 0) void handleSave();
        }}
        className="space-y-4 text-start"
      >
        <p className="text-sm text-muted-foreground m-0">
          {t("contacts.selectedCount", { count: selectedCount })}
        </p>
        <Field id="bulk-tag-input" label={t("contacts.bulkTagPlaceholder")}>
          <Input
            id="bulk-tag-input"
            name="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder={t("contacts.bulkTags.placeholder")}
            disabled={isPending}
            className={FORM_INPUT}
          />
        </Field>
      </form>
    </FormModal>
  );
}
