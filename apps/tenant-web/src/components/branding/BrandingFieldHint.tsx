import React from "react";
import { cn } from "@mms/ui";

interface FieldHintProps {
  id: string;
  children: React.ReactNode;
  className?: string;
}

export function FieldHint({ id, children, className }: FieldHintProps): React.JSX.Element {
  return (
    <p id={id} className={cn("text-xs text-muted-foreground", className)}>
      {children}
    </p>
  );
}
