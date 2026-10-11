import type React from "react";
import { Edit3, Plus } from "lucide-react";
import type { MessageCategory } from "@mms/shared";
import { FormSelect } from "@/components/ui/FormSelect";
import { Field } from "@/components/ui/FormPrimitives";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { FormModal } from "@/components/ui/FormModal";
import { Input } from "@/components/ui/input";
import { MessagingMessageBodyField } from "@/components/ui/MessagingMessageBodyField";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

const TEMPLATE_FORM_ID = "messaging-setup-template-form";

interface MessagingSetupTemplateFormProps {
  open: boolean;
  editingId: string | null;
  label: string;
  body: string;
  category: MessageCategory;
  channel: "all" | "sms" | "whatsapp" | "email";
  templateCategorySelectOptions: Array<{ value: string; label: string }>;
  channelSelectOptions: Array<{ value: string; label: string }>;
  errors?: Record<string, string>;
  saving?: boolean;
  saveDisabled?: boolean;
  isDirty?: boolean;
  onReset: () => void;
  onSave: () => void | Promise<void>;
  onLabelChange: (value: string) => void;
  onBodyChange: (value: string) => void;
  onBodyBlur?: () => void;
  onCategoryChange: (value: MessageCategory) => void;
  onChannelChange: (value: "all" | "sms" | "whatsapp" | "email") => void;
}

export function MessagingSetupTemplateForm({
  open,
  editingId,
  label,
  body,
  category,
  channel,
  templateCategorySelectOptions,
  channelSelectOptions,
  errors = {},
  saving = false,
  saveDisabled = false,
  isDirty = false,
  onReset,
  onSave,
  onLabelChange,
  onBodyChange,
  onBodyBlur,
  onCategoryChange,
  onChannelChange,
}: MessagingSetupTemplateFormProps): React.JSX.Element {
  const { t } = useTranslation();

  const trySave = (): void => {
    if (saveDisabled) return;
    void onSave();
  };

  return (
    <FormModal
      open={open}
      onClose={onReset}
      title={editingId ? t("messaging.editPreset") : t("messaging.createPreset")}
      subtitle={t("messaging.createPresetDesc")}
      icon={editingId ? Edit3 : Plus}
      cancelLabel={t("common.cancel")}
      saveLabel={editingId ? t("messaging.updateTemplate") : t("messaging.saveTemplate")}
      onSave={trySave}
      saving={saving}
      saveDisabled={saveDisabled}
      isDirty={isDirty}
      discardUnsavedTitle={t("settings.unsavedChanges")}
      discardUnsavedDescription={t("messaging.setup.discardUnsavedTemplateConfirm")}
      discardConfirmLabel={t("common.yes")}
      discardCancelLabel={t("common.cancel")}
      formId={TEMPLATE_FORM_ID}
    >
      <form
        id={TEMPLATE_FORM_ID}
        onSubmit={(event) => {
          event.preventDefault();
          trySave();
        }}
        onKeyDown={(event) => {
          if (!(event.metaKey || event.ctrlKey) || event.key !== "Enter") return;
          if (event.nativeEvent.isComposing) return;
          event.preventDefault();
          trySave();
        }}
        className="space-y-3"
      >
        <Field id="tplLabel" label={t("messaging.templateLabel")} required error={errors.label}>
          <Input
            id="tplLabel"
            name="tplLabel"
            value={label}
            onChange={(event) => onLabelChange(event.target.value)}
            placeholder={t("messaging.templateLabelPlaceholder")}
            required
            className={cn(errors.label && FORM_INPUT_ERROR)}
          />
        </Field>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <Field id="tplCategory" label={t("messaging.category")}>
            <FormSelect
              id="tplCategory"
              name="category"
              value={category}
              onChange={(value) => onCategoryChange(value as MessageCategory)}
              options={templateCategorySelectOptions}
            />
          </Field>
          <Field id="tplChannel" label={t("messaging.targetChannel")}>
            <FormSelect
              id="tplChannel"
              name="channel"
              value={channel}
              onChange={(value) => onChannelChange(value as typeof channel)}
              options={channelSelectOptions}
            />
          </Field>
        </div>
        <MessagingMessageBodyField
          id="tplBody"
          value={body}
          onChange={onBodyChange}
          onBlur={onBodyBlur}
          placeholder={t("messaging.templateBodyPlaceholder")}
          required
          error={errors.body}
        />
      </form>
    </FormModal>
  );
}
