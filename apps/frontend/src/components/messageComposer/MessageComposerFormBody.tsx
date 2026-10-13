import { useRef } from "react";
import {
  getMessageCategoryLabelKey,
  insertVariableTokenAt,
  type MessageTemplate,
} from "@mms/shared";
import { FormSelect } from "@/components/app/FormSelect";
import { Field } from "@/components/app/FormPrimitives";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { Input } from "@/components/ui/input";
import { MessagingMessageBodyField } from "@/components/app/MessagingMessageBodyField";
import { MessagingVariableTokensBar } from "@/components/app/MessagingVariableTokensBar";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { ValidatedMessagingRecipient } from "./useMessageComposerDispatch";
import { MessageComposerLivePreview } from "./MessageComposerLivePreview";
import { MessageComposerSmsCostFooter } from "./MessageComposerSmsCostFooter";

interface MessageComposerFormBodyProps {
  channel: "sms" | "whatsapp" | "email";
  channelTemplates: MessageTemplate[];
  templateId: string;
  subject: string;
  message: string;
  messageError?: string;
  subjectError?: string;
  eligibleRecipients: ValidatedMessagingRecipient[];
  previewIndex: number;
  personalizeOptions: { madrasaName?: string };
  onTemplateChange: (templateId: string) => void;
  onSubjectChange: (subject: string) => void;
  onMessageChange: (message: string) => void;
  onMessageBlur?: () => void;
  onSubjectBlur?: () => void;
  onPreviewIndexChange: (index: number) => void;
}

export function MessageComposerFormBody({
  channel,
  channelTemplates,
  templateId,
  subject,
  message,
  messageError,
  subjectError,
  eligibleRecipients,
  previewIndex,
  personalizeOptions,
  onTemplateChange,
  onSubjectChange,
  onMessageChange,
  onMessageBlur,
  onSubjectBlur,
  onPreviewIndexChange,
}: MessageComposerFormBodyProps): React.JSX.Element {
  const { t } = useTranslation();
  const isEmail = channel === "email";
  const isSms = channel === "sms";
  const previewRecipient = eligibleRecipients[previewIndex] || eligibleRecipients[0];
  const subjectRef = useRef<HTMLInputElement>(null);

  const insertSubjectToken = (token: string): void => {
    const el = subjectRef.current;
    const start = el?.selectionStart ?? subject.length;
    const end = el?.selectionEnd ?? start;
    const { next, caret } = insertVariableTokenAt(subject, token, start, end);
    onSubjectChange(next);
    requestAnimationFrame(() => {
      const node = subjectRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(caret, caret);
    });
  };

  return (
    <div className="space-y-3">
      {isEmail && (
        <Field id="emailSubject" label={t("messaging.subject")} required error={subjectError}>
          <MessagingVariableTokensBar onSelectToken={insertSubjectToken} className="mb-2" />
          <Input
            ref={subjectRef}
            id="emailSubject"
            name="emailSubject"
            value={subject}
            onChange={(event) => onSubjectChange(event.target.value)}
            onBlur={onSubjectBlur}
            placeholder={t("messaging.subjectPlaceholder")}
            required
            aria-invalid={subjectError ? true : undefined}
            className={cn(subjectError && FORM_INPUT_ERROR)}
          />
        </Field>
      )}

      {channelTemplates.length > 0 && (
        <Field id="messageTemplate" label={t("messaging.messageTemplate")}>
          <FormSelect
            id="messageTemplate"
            name="messageTemplate"
            value={templateId}
            onChange={onTemplateChange}
            options={channelTemplates.map((template) => ({
              value: template.id,
              label: `${template.labelKey ? t(template.labelKey as Parameters<typeof t>[0]) : template.label} [${t(getMessageCategoryLabelKey(template.category || "general"))}]`,
            }))}
          />
        </Field>
      )}

      <MessagingMessageBodyField
        id="messageBody"
        value={message}
        onChange={onMessageChange}
        onBlur={onMessageBlur}
        placeholder={t("messaging.templateBodyPlaceholder")}
        required
        error={messageError}
        footer={
          isSms ? (
            <MessageComposerSmsCostFooter
              message={message}
              previewRecipient={previewRecipient}
              personalizeOptions={personalizeOptions}
            />
          ) : (
            <div className="mt-1 flex justify-end font-mono text-xs text-muted-foreground">
              <span>
                {message.length} {t("messaging.chars")}
              </span>
            </div>
          )
        }
      />

      <MessageComposerLivePreview
        channel={channel}
        message={message}
        subject={subject}
        eligibleRecipients={eligibleRecipients}
        previewIndex={previewIndex}
        personalizeOptions={personalizeOptions}
        onPreviewIndexChange={onPreviewIndexChange}
      />
    </div>
  );
}
