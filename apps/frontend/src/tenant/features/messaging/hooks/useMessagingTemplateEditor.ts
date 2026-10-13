import { useState } from "react";
import {
  findUnknownPersonalizationTokens,
  messageTemplateInputSchema,
  type AppTranslationKey,
  type MessageCategory,
  type MessageTemplate,
} from "@mms/shared";
import { notify } from "@/lib/notify";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { mapZodFormErrors } from "@/lib/forms/mapZodFormErrors";
import { formatUnknownTokensLabel } from "@/components/messageComposer/messageComposerTokenErrors";
import { useMessagingMutations } from "./useMessaging";

type TemplateChannel = "all" | "sms" | "whatsapp" | "email";
interface Baseline {
  label: string;
  body: string;
  category: MessageCategory;
  channel: TemplateChannel;
}
const EMPTY: Baseline = { label: "", body: "", category: "general", channel: "all" };

export function useMessagingTemplateEditor() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { saveTemplate } = useMessagingMutations();
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState("");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<MessageCategory>("general");
  const [channel, setChannel] = useState<TemplateChannel>("all");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [baseline, setBaseline] = useState<Baseline>(EMPTY);

  const isFormDirty =
    formOpen &&
    (label !== baseline.label ||
      body !== baseline.body ||
      category !== baseline.category ||
      channel !== baseline.channel);
  const saveDisabled =
    !label.trim() ||
    !body.trim() ||
    findUnknownPersonalizationTokens(body).length > 0 ||
    saveTemplate.isPending;

  const applyFields = (next: Baseline, id: string | null): void => {
    setEditingId(id);
    setLabel(next.label);
    setBody(next.body);
    setCategory(next.category);
    setChannel(next.channel);
    setBaseline(next);
    setErrors({});
  };

  const resetForm = (): void => {
    applyFields(EMPTY, null);
    setFormOpen(false);
  };
  const openCreate = (): void => {
    applyFields(EMPTY, null);
    setFormOpen(true);
  };

  const handleLabelChange = (value: string): void => {
    setLabel(value);
    if (!errors.label) return;
    setErrors((prev) => {
      const next = { ...prev };
      delete next.label;
      return next;
    });
  };

  const syncBodyTokenErrorOnBlur = (): void => {
    const unknown = findUnknownPersonalizationTokens(body);
    setErrors((prev) => {
      const next = { ...prev };
      if (unknown.length > 0) {
        next.body = t("messaging.unknownTokens", { tokens: formatUnknownTokensLabel(unknown) });
      } else {
        delete next.body;
      }
      return next;
    });
  };

  const save = async (): Promise<void> => {
    if (!user) return;
    const parsed = messageTemplateInputSchema.safeParse({
      id: editingId ?? undefined,
      label: label.trim(),
      body: body.trim(),
      category,
      channel,
    });
    if (!parsed.success) {
      const fieldErrors = mapZodFormErrors(parsed.error, (message) => {
        if (message.startsWith("Unknown personalization tokens:")) {
          return t("messaging.unknownTokens", {
            tokens: message.replace(/^Unknown personalization tokens:\s*/, ""),
          });
        }
        if (message.toLowerCase().includes("required") || message.includes("at least")) {
          return t("common.required");
        }
        return t(message as AppTranslationKey);
      });
      setErrors(fieldErrors);
      notify.error(fieldErrors.body || fieldErrors.label || t("messaging.createPresetDesc"));
      return;
    }
    try {
      await saveTemplate.mutateAsync({ body: parsed.data });
      notify.success(t("messaging.saveTemplate"));
      resetForm();
    } catch {
      /* Mutation hook reports the failure. */
    }
  };

  const handleEdit = (template: MessageTemplate): void => {
    applyFields(
      {
        label: template.label,
        body: template.body,
        category: (template.category || "general") as MessageCategory,
        channel: (template.channel || "all") as TemplateChannel,
      },
      template.id,
    );
    setFormOpen(true);
  };

  const handleDuplicate = async (template: MessageTemplate): Promise<void> => {
    if (!user) return;
    const unknownTokens = findUnknownPersonalizationTokens(template.body);
    if (unknownTokens.length > 0) {
      notify.error(
        t("messaging.unknownTokens", { tokens: formatUnknownTokensLabel(unknownTokens) }),
      );
      return;
    }
    try {
      await saveTemplate.mutateAsync({
        body: {
          label: `${template.label} (${t("messaging.tagCustom")})`,
          body: template.body,
          category: template.category || "general",
          channel: template.channel || "all",
        },
      });
      notify.success(t("messaging.duplicateSuccess"));
    } catch {
      /* Mutation hook reports the failure. */
    }
  };

  const handleCopy = async (templateBody: string): Promise<void> => {
    await navigator.clipboard.writeText(templateBody);
    notify.success(t("messaging.copySuccess"));
  };

  return {
    formOpen,
    editingId,
    label,
    body,
    category,
    setCategory,
    channel,
    setChannel,
    errors,
    isFormDirty,
    saving: saveTemplate.isPending,
    saveDisabled,
    resetForm,
    openCreate,
    handleLabelChange,
    handleBodyChange: setBody,
    syncBodyTokenErrorOnBlur,
    save,
    handleEdit,
    handleDuplicate,
    handleCopy,
  };
}
