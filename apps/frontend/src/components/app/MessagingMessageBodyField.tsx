import { useRef, type ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { insertVariableTokenAt } from "@mms/shared";
import { Field } from "@/components/app/FormPrimitives";
import { FORM_INPUT_ERROR } from "@/components/ui/formStyles";
import { MessagingVariableTokensBar } from "@/components/app/MessagingVariableTokensBar";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

export interface MessagingMessageBodyFieldProps {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  placeholder: string;
  required?: boolean;
  error?: string;
  footer?: ReactNode;
}

/**
 * Shared message-body field for Setup templates and campaign composition:
 * label → variable tokens → textarea → Sparkles fallback hint (+ optional footer).
 */
export function MessagingMessageBodyField({
  id,
  name,
  value,
  onChange,
  onBlur,
  placeholder,
  required = false,
  error,
  footer,
}: MessagingMessageBodyFieldProps): React.JSX.Element {
  const { t } = useTranslation();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertToken = (token: string): void => {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? start;
    const { next, caret } = insertVariableTokenAt(value, token, start, end);
    onChange(next);
    requestAnimationFrame(() => {
      const node = textareaRef.current;
      if (!node) return;
      node.focus();
      node.setSelectionRange(caret, caret);
    });
  };

  return (
    <Field id={id} label={t("messaging.messageBody")} required={required} error={error}>
      <MessagingVariableTokensBar onSelectToken={insertToken} className="mb-2" />
      <Textarea
        ref={textareaRef}
        id={id}
        name={name ?? id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onBlur={onBlur}
        placeholder={placeholder}
        rows={4}
        required={required}
        className={cn(error && FORM_INPUT_ERROR)}
      />
      <p className="mt-1 flex items-center gap-1 text-xs italic text-muted-foreground">
        <Sparkles className="h-3 w-3 flex-shrink-0 text-primary/70" />
        {t("messaging.fallbackHint")}
      </p>
      {footer}
    </Field>
  );
}
