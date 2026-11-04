import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Form-level validation errors. Announced as an alert and focused the first
 * time errors appear; later updates do not steal focus from the field the user
 * is fixing.
 *
 * When `onSelectError` is provided each message becomes a button that jumps to
 * the offending control — WCAG 2.2 / UI guidance: a summary complements inline
 * errors only if it is operable, not a visual-only list.
 */
export function FormErrorBanner({
  errors,
  onSelectError,
}: {
  errors: readonly string[];
  onSelectError?: (index: number) => void;
}): React.JSX.Element | null {
  const bannerRef = useRef<HTMLDivElement | null>(null);
  const hadErrorsRef = useRef(false);
  const hasErrors = errors.length > 0;

  useEffect(() => {
    if (hasErrors && !hadErrorsRef.current) {
      bannerRef.current?.focus();
    }
    hadErrorsRef.current = hasErrors;
  }, [hasErrors]);

  if (!hasErrors) return null;

  return (
    <div
      ref={bannerRef}
      role="alert"
      aria-atomic="true"
      tabIndex={-1}
      className="mb-3 space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive outline-none"
    >
      {errors.map((message, index) =>
        onSelectError ? (
          <button
            key={`${message}-${index}`}
            type="button"
            onClick={() => onSelectError(index)}
            className={cn(
              "flex min-h-11 w-full items-start gap-1.5 rounded px-1 text-start font-semibold text-destructive",
              "underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/50",
            )}
          >
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{message}</span>
          </button>
        ) : (
          <p key={`${message}-${index}`} className="flex items-start gap-1.5">
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            {message}
          </p>
        ),
      )}
    </div>
  );
}
