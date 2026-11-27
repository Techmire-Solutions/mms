import React from "react";
import { Input } from "@mms/ui";
import { FormModal } from "@mms/fe-core/components/FormModal";
import { Field } from "@mms/fe-core/components/FormPrimitives";
import { useDirtySnapshot } from "@mms/fe-core/forms/useDirtySnapshot";
import type { TranslationFunction } from "@mms/fe-core/i18n";

interface BrandSaveCustomPresetModalProps {
  open: boolean;
  onClose: () => void;
  primaryColor: string;
  secondaryColor: string;
  presetNameDraft: string;
  onPresetNameDraftChange: (val: string) => void;
  onSave: () => void;
  t: TranslationFunction;
}

export function BrandSaveCustomPresetModal({
  open,
  onClose,
  primaryColor,
  secondaryColor,
  presetNameDraft,
  onPresetNameDraftChange,
  onSave,
  t,
}: BrandSaveCustomPresetModalProps) {
  // The parent seeds the default preset name on open; only a user edit is dirty.
  const { isDirty } = useDirtySnapshot(presetNameDraft, String(open));

  return (
    <FormModal
      open={open}
      onClose={onClose}
      title={t("theme.saveCustomPresetTitle")}
      subtitle={t("theme.saveCustomPresetDesc")}
      size="sm"
      formId="brand-save-custom-preset-form"
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      saveDisabled={!presetNameDraft.trim()}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("common.discardUnsavedDescription")}
      onSave={() => {
        if (presetNameDraft.trim()) onSave();
      }}
    >
      <form
        id="brand-save-custom-preset-form"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (presetNameDraft.trim()) onSave();
        }}
        className="space-y-4 py-1"
      >
        <div className="flex items-center gap-3 p-3 rounded-xl border border-border/80 bg-muted/30">
          <div className="flex items-center -space-x-2 rtl:space-x-reverse">
            <span
              className="size-8 rounded-md border-2 border-background shadow-xs shrink-0"
              aria-hidden="true"
              style={{ backgroundColor: primaryColor }}
              aria-label={primaryColor}
            />
            <span
              className="size-8 rounded-md border-2 border-background shadow-xs shrink-0"
              aria-hidden="true"
              style={{ backgroundColor: secondaryColor }}
              aria-label={secondaryColor}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold text-foreground truncate">
              {primaryColor} & {secondaryColor}
            </p>
            <p className="text-2xs text-muted-foreground font-mono truncate">
              {t("theme.activeConfig")}
            </p>
          </div>
        </div>

        <Field id="preset-name-input" label={t("theme.presetNameLabel")} required>
          <Input
            id="preset-name-input"
            value={presetNameDraft}
            onChange={(e) => onPresetNameDraftChange(e.target.value)}
            placeholder={t("theme.presetNamePlaceholder")}
            autoFocus
            className="min-h-11 h-11 text-xs"
          />
        </Field>
      </form>
    </FormModal>
  );
}
