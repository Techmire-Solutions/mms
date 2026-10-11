import React from "react";

export interface AuthStepFormProps {
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  busy: boolean;
  children: React.ReactNode;
}

/** Local form wrapper — owns the shared className/noValidate/aria-busy so each view step is DRY. */
export function AuthStepForm({ onSubmit, busy, children }: AuthStepFormProps): React.JSX.Element {
  return (
    <form
      onSubmit={(event) => onSubmit(event)}
      className="mt-4 space-y-4"
      noValidate
      aria-busy={busy}
    >
      {children}
    </form>
  );
}
