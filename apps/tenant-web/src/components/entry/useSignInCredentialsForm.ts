import { useId, useState, useCallback } from "react";
import type { TranslationFunction } from "@mms/fe-core/i18n";
import {
  firstSignInErrorFieldId,
  focusAuthField,
  validateSignInCredentials,
  type SignInFieldErrors,
} from "./authValidation";

export interface UseSignInCredentialsFormOptions {
  /** Optional initial email value (e.g. from remembered email storage). */
  initialEmail?: string;
  /** Translation function. */
  t: TranslationFunction;
  /** Optional explicit email input ID (defaults to `${useId()}-email`). */
  emailFieldId?: string;
  /** Optional explicit password input ID (defaults to `${useId()}-password`). */
  passwordFieldId?: string;
}

export interface UseSignInCredentialsFormReturn {
  formId: string;
  emailFieldId: string;
  passwordFieldId: string;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  fieldErrors: SignInFieldErrors;
  setFieldErrors: React.Dispatch<React.SetStateAction<SignInFieldErrors>>;
  error: string | null;
  setError: (error: string | null) => void;
  hasEmail: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  validate: () => boolean;
  reset: (newEmail?: string) => void;
}

/**
 * Shared hook managing credential state, auto-clearing validation,
 * accessibility IDs, and first-error autofocus across platform and tenant sign-in forms.
 */
export function useSignInCredentialsForm({
  initialEmail = "",
  t,
  emailFieldId: customEmailFieldId,
  passwordFieldId: customPasswordFieldId,
}: UseSignInCredentialsFormOptions): UseSignInCredentialsFormReturn {
  const formId = useId();
  const emailFieldId = customEmailFieldId ?? `${formId}-email`;
  const passwordFieldId = customPasswordFieldId ?? `${formId}-password`;

  const [email, setEmail] = useState<string>(initialEmail);
  const [password, setPassword] = useState<string>("");
  const [fieldErrors, setFieldErrors] = useState<SignInFieldErrors>({});
  const [error, setError] = useState<string | null>(null);

  const hasEmail = Boolean(email.trim());

  const onEmailChange = useCallback((value: string) => {
    setEmail(value);
    setFieldErrors((prev) => (prev.email ? { ...prev, email: undefined } : prev));
    setError(null);
  }, []);

  const onPasswordChange = useCallback((value: string) => {
    setPassword(value);
    setFieldErrors((prev) => (prev.password ? { ...prev, password: undefined } : prev));
    setError(null);
  }, []);

  const validate = useCallback((): boolean => {
    setError(null);
    const errs = validateSignInCredentials(email, password, t);
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const focusId = firstSignInErrorFieldId(errs, emailFieldId, passwordFieldId);
      if (focusId) {
        focusAuthField(focusId);
      }
      return false;
    }
    setFieldErrors({});
    return true;
  }, [email, password, t, emailFieldId, passwordFieldId]);

  const reset = useCallback((newEmail = "") => {
    setEmail(newEmail);
    setPassword("");
    setFieldErrors({});
    setError(null);
  }, []);

  return {
    formId,
    emailFieldId,
    passwordFieldId,
    email,
    setEmail,
    password,
    setPassword,
    fieldErrors,
    setFieldErrors,
    error,
    setError,
    hasEmail,
    onEmailChange,
    onPasswordChange,
    validate,
    reset,
  };
}
