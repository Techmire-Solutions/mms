import type React from "react";
import { AlertCircle } from "lucide-react";

export function FormErrorBanner({
  errors,
}: {
  errors: readonly string[];
}): React.JSX.Element | null {
  if (errors.length === 0) return null;
  return (
    <div className="mb-3 space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
      {errors.map((message) => (
        <p key={message} className="flex items-start gap-1.5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {message}
        </p>
      ))}
    </div>
  );
}
