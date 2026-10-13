/**
 * @file EntityNotesFormSection.tsx
 * @description Shared form notes section — SectionCard + Field + Textarea.
 */

import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { FileText } from "lucide-react";
import { Field } from "@/components/ui/FormPrimitives";
import { SectionCard, type SectionCardProps } from "@/components/ui/SectionCard";
import { Textarea } from "@/components/ui/textarea";
import { FORM_TEXTAREA } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

export interface EntityNotesFormSectionProps {
  title: ReactNode;
  subtitle?: ReactNode;
  label: ReactNode;
  placeholder?: string;
  value?: string;
  required?: boolean;
  error?: string;
  id?: string;
  name?: string;
  icon?: LucideIcon;
  accentColor?: SectionCardProps["accentColor"];
  onChange: (value: string) => void;
}

export function EntityNotesFormSection({
  title,
  subtitle,
  label,
  placeholder,
  value,
  required = false,
  error,
  id = "notes",
  name = "notes",
  icon: Icon = FileText,
  accentColor = "emerald",
  onChange,
}: EntityNotesFormSectionProps): React.JSX.Element {
  return (
    <div className="space-y-6">
      <SectionCard title={title} subtitle={subtitle} icon={Icon} accentColor={accentColor}>
        <Field label={label} id={id} required={required} error={error}>
          <Textarea
            id={id}
            name={name}
            required={required}
            value={value || ""}
            onChange={(event) => onChange(event.target.value)}
            placeholder={placeholder}
            className={cn(FORM_TEXTAREA, "min-h-30")}
          />
        </Field>
      </SectionCard>
    </div>
  );
}
