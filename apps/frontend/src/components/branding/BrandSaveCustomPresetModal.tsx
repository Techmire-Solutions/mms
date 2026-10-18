import React from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/app/Modal";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

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
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("theme.saveCustomPresetTitle")}
      subtitle={t("theme.saveCustomPresetDesc")}
      size="sm"
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="min-h-10 px-3 text-xs text-muted-foreground hover:text-foreground"
          >
            {t("common.cancel")}
          </Button>
          <Button
            type="submit"
            form="brand-save-custom-preset-form"
            variant="default"
            size="sm"
            disabled={!presetNameDraft.trim()}
            className="min-h-10 px-4 text-xs font-semibold"
          >
            {t("common.save")}
          </Button>
        </div>
      }
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
              className="h-8 w-8 rounded-full border-2 border-background shadow-xs shrink-0"
              style={{ backgroundColor: primaryColor }}
              aria-label={primaryColor}
            />
            <span
              className="h-8 w-8 rounded-full border-2 border-background shadow-xs shrink-0"
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

        <div className="space-y-2">
          <Label htmlFor="preset-name-input">{t("theme.presetNameLabel")}</Label>
          <Input
            id="preset-name-input"
            value={presetNameDraft}
            onChange={(e) => onPresetNameDraftChange(e.target.value)}
            placeholder={t("theme.presetNamePlaceholder")}
            autoFocus
            className="min-h-11 h-11 text-xs"
          />
        </div>
      </form>
    </Modal>
  );
}
