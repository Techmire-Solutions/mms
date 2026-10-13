import type React from "react";
import { Field } from "@/components/app/FormPrimitives";
import { Input } from "@/components/ui/input";
import { FormSelect } from "@/components/app/FormSelect";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/useTranslation";
import type { ModuleFieldDef } from "@mms/shared";

interface QuestionSourceInputProps {
  field: ModuleFieldDef;
  value: string;
  onChange: (value: string) => void;
  label: string;
  inputId: string;
  required?: boolean;
}

export function QuestionSourceInput({
  field,
  value,
  onChange,
  label,
  inputId,
  required,
}: QuestionSourceInputProps): React.ReactNode {
  const { t } = useTranslation();
  return (
    <div key={field.id} className={field.type === "textarea" ? "sm:col-span-2" : ""}>
      <Field id={inputId} label={`${label}${required ? " *" : ""}`} required={required}>
        {field.type === "textarea" ? (
          <Textarea
            id={inputId}
            name={inputId}
            value={value}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        ) : field.type === "select" ? (
          <FormSelect
            id={inputId}
            name={inputId}
            value={value}
            onChange={onChange}
            options={field.options?.map((opt) => ({ value: opt, label: opt })) || []}
            placeholder={t("questionBank.source.placeholder")}
          />
        ) : (
          <Input
            id={inputId}
            name={inputId}
            type="text"
            value={value}
            onChange={(e: React.ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
            placeholder={field.placeholder}
          />
        )}
      </Field>
    </div>
  );
}
