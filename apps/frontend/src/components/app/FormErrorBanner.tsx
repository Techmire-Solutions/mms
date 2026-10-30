import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";

/**
 * Form-level validation errors. Announced as an alert and focused the first
 * time errors appear; later updates do not steal focus from the field the user
 * is fixing.
 */
export function FormErrorBanner({
  errors,
}: {
  errors: readonly string[];
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
      {errors.map((message) => (
        <p key={message} className="flex items-start gap-1.5">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          {message}
        </p>
      ))}
    </div>
  );
}
