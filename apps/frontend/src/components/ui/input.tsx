import * as React from "react";

import { cn } from "@/lib/utils";
import { FORM_INPUT } from "@/components/ui/formStyles";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  ref?: React.Ref<HTMLInputElement>;
}

/**
 * Standard input — aligned with {@link FORM_INPUT} for consistent form theme.
 */
function Input({ className, type, id, name, ref, ...props }: InputProps) {
  const fallbackId = React.useId();
  const resolvedId = id || fallbackId;
  const resolvedName = name || fallbackId;
  return (
    <input
      type={type}
      id={resolvedId}
      name={resolvedName}
      className={cn(FORM_INPUT, className)}
      ref={ref}
      {...props}
    />
  );
}
Input.displayName = "Input";

export { Input };
