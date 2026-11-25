import { translateApiMessage } from "@/lib/forms/translateValidationMessage";
import type React from "react";
import { useMemo, useState } from "react";
import { Tag } from "lucide-react";
import {
  CONTACTS_BULK_TAG_MAX_CONTACTS,
  CONTACTS_BULK_TAG_MAX_TAGS,
  isReservedSystemTagName,
} from "@mms/contracts";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { FORM_INPUT } from "@/components/ui/formStyles";
import { mapApiFormError } from "@/lib/forms/serverFormErrors";
import { useSubmitGuard } from "@/lib/forms/useSubmitGuard";

export type BulkTagMode = "add" | "remove";

export interface ContactsBulkTagModalProps {
  open: boolean;
  onClose: () => void;
  selectedCount: number;
  onConfirm: (tags: string[], mode: BulkTagMode) => Promise<void> | void;
  isPending?: boolean;
}

/** Parses the comma-separated input into unique tag names. */
function parseTags(value: string): string[] {
  // De-duplicate case-insensitively (the server treats tag names as one tag
  // namespace) while preserving the first typed casing.
  const seen = new Map<string, string>();
  for (const raw of value.split(",")) {
    const tag = raw.trim();
    if (!tag) continue;
    const key = tag.toLowerCase();
    if (!seen.has(key)) seen.set(key, tag);
  }
  return [...seen.values()];
}

export function ContactsBulkTagModal({
  open,
  onClose,
  selectedCount,
  onConfirm,
  isPending = false,
}: ContactsBulkTagModalProps): React.JSX.Element | null {
  const { t } = useTranslation();
  const { tags: availableTags } = useContactConfig();
  const [tagInput, setTagInput] = useState("");
  const [mode, setMode] = useState<BulkTagMode>("add");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const guard = useSubmitGuard();

  // Cancel/Esc close the modal without saving — never reopen with the previous
  // half-typed value or the previous mode. Adjusted during render (the same
  // pattern the contact form uses for its tab reset) instead of an effect.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (!open) {
      setTagInput("");
      setMode("add");
    }
  }

  const parsedTags = useMemo(() => parseTags(tagInput), [tagInput]);

  const suggestions = useMemo(
    () =>
      availableTags
        .filter((tag) => !isReservedSystemTagName(tag))
        .filter((tag) => !parsedTags.some((current) => current.toLowerCase() === tag.toLowerCase()))
        .slice(0, 12),
    [availableTags, parsedTags],
  );

  if (!open) return null;

  const toggleSuggestion = (tag: string) => {
    setTagInput((current) => {
      const next = parseTags(current);
      if (next.some((value) => value.toLowerCase() === tag.toLowerCase())) {
        return next.filter((value) => value.toLowerCase() !== tag.toLowerCase()).join(", ");
      }
      return [...next, tag].join(", ");
    });
  };

  const handleSave = async () => {
    const tags = parsedTags;
    if (selectedCount > CONTACTS_BULK_TAG_MAX_CONTACTS) {
      setFormError(t("contacts.bulkTagTooManyContacts", { max: CONTACTS_BULK_TAG_MAX_CONTACTS }));
      return;
    }
    if (tags.length > CONTACTS_BULK_TAG_MAX_TAGS) {
      setFormError(t("contacts.bulkTagTooManyTags", { max: CONTACTS_BULK_TAG_MAX_TAGS }));
      return;
    }
    if (tags.some((value) => isReservedSystemTagName(value))) {
      setFormError(t("contacts.tags.reserved"));
      return;
    }
    if (tags.length === 0) return;
    await guard(async () => {
      setSubmitting(true);
      setFormError(null);
      try {
        await onConfirm(tags, mode);
        setTagInput("");
        setMode("add");
        onClose();
      } catch (error) {
        setFormError(
          mapApiFormError(error, (message) => translateApiMessage(message, t)).message ??
            t("common.formPleaseFixErrors"),
        );
      } finally {
        setSubmitting(false);
      }
    });
  };

  const isRemove = mode === "remove";
  const saving = isPending || submitting;

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={isRemove ? t("contacts.bulkTagTitleRemove") : t("contacts.bulkTagTitle")}
      icon={Tag}
      size="sm"
      cancelLabel={t("common.cancel")}
      saveLabel={isRemove ? t("contacts.bulkTagModeRemove") : t("contacts.bulkTagAdd")}
      onSave={handleSave}
      saving={saving}
      saveDisabled={saving || tagInput.trim().length === 0}
      error={formError ?? undefined}
      isDirty={Boolean(tagInput.trim()) || mode !== "add"}
      formId="bulk-tag-form"
    >
      <form
        id="bulk-tag-form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (!saving && tagInput.trim().length > 0) void handleSave();
        }}
        className="space-y-4 text-start"
      >
        <p className="text-sm text-muted-foreground m-0 text-pretty">
          {t("contacts.selectedCount", { count: selectedCount })}
        </p>

        <div className="space-y-1.5">
          <p className="text-xs font-semibold text-muted-foreground m-0 text-pretty">
            {t("contacts.bulkTagMode")}
          </p>
          <div role="group" aria-label={t("contacts.bulkTagMode")} className="flex gap-2">
            {(["add", "remove"] as const).map((option) => (
              <Button
                key={option}
                type="button"
                variant={mode === option ? "default" : "outline"}
                aria-pressed={mode === option}
                onClick={() => setMode(option)}
                className="min-h-11 flex-1 px-3 text-xs font-semibold"
              >
                {option === "add" ? t("contacts.bulkTagModeAdd") : t("contacts.bulkTagModeRemove")}
              </Button>
            ))}
          </div>
        </div>

        <Field id="bulk-tag-input" label={t("contacts.bulkTagPlaceholder")}>
          <Input
            id="bulk-tag-input"
            name="tags"
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            placeholder={t("contacts.bulkTags.placeholder")}
            disabled={isPending}
            className={FORM_INPUT}
            autoComplete="off"
          />
        </Field>

        {suggestions.length > 0 && (
          <div className="space-y-1.5">
            <p className="text-xs font-semibold text-muted-foreground m-0 text-pretty">
              {t("contacts.bulkTagSuggestions")}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {suggestions.map((tag) => {
                const active = parsedTags.some(
                  (value) => value.toLowerCase() === tag.toLowerCase(),
                );
                return (
                  <Button
                    key={tag}
                    type="button"
                    variant={active ? "default" : "outline"}
                    aria-pressed={active}
                    onClick={() => toggleSuggestion(tag)}
                    disabled={isPending}
                    className="min-h-11 px-2.5 text-xs font-medium"
                  >
                    {tag}
                  </Button>
                );
              })}
            </div>
          </div>
        )}
      </form>
    </FormModal>
  );
}
