import * as React from "react";
import { Check } from "lucide-react";
import { CopyButton } from "../button/CopyButton";

export interface CredentialsResultField {
  label: string;
  value: string;
}

export interface CredentialsResultCardProps {
  title: string;
  fields: CredentialsResultField[];
  passwordLabel: string;
  password: string;
  copyText: string;
  copyLabel: string;
  hint: string;
}

export function CredentialsResultCard({
  title,
  fields,
  passwordLabel,
  password,
  copyText,
  copyLabel,
  hint,
}: CredentialsResultCardProps): React.JSX.Element {
  return (
    <div className="space-y-4 py-2 text-start">
      <div className="rounded-xl border border-success/30 bg-success/10 p-4 space-y-3">
        <div role="status" className="flex items-center gap-2 text-success font-bold text-sm">
          <Check className="w-4 h-4 shrink-0" aria-hidden="true" />
          {title}
        </div>
        <div className="space-y-2 text-xs text-foreground">
          {fields.map(({ label, value }) => (
            <div key={label} className="break-words">
              <span className="text-muted-foreground">{label}</span>{" "}
              <span className="font-semibold text-foreground">{value}</span>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <div className="min-w-0">
              <span className="text-muted-foreground block text-2xs mb-0.5">{passwordLabel}</span>
              <code className="font-mono font-bold bg-background px-2.5 py-1 rounded-md border border-border text-sm text-primary inline-block max-w-full break-all">
                {password}
              </code>
            </div>
            <CopyButton text={copyText} label={copyLabel} className="min-h-11 h-11 px-3 text-xs" />
          </div>
        </div>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed text-pretty">{hint}</p>
    </div>
  );
}
