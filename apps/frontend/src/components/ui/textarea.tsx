import * as React from "react";

import { cn } from "@/lib/utils";
import { FORM_TEXTAREA } from "@/components/ui/formStyles";

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  ref?: React.Ref<HTMLTextAreaElement>;
}

function Textarea({ className, id, name, ref, ...props }: TextareaProps) {
  const fallbackId = React.useId();
  const resolvedId = id || fallbackId;
  const resolvedName = name || fallbackId;
  return (
    <textarea
      id={resolvedId}
      name={resolvedName}
      className={cn(FORM_TEXTAREA, className)}
      ref={ref}
      {...props}
    />
  );
}
Textarea.displayName = "Textarea";

export { Textarea };
