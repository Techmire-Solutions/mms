import { useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/contexts/AuthContext";
import { DEFAULT_AUTH_REDIRECT, ROUTES } from "@/lib/config/routes";
import { clear2FAState, is2FAVerified, mark2FAVerified } from "@/lib/twoFactor";
import { requiresTwoFactor } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { getAuthErrorMessage } from "@/lib/authErrors";
import { useSignInCredentialsForm } from "@/components/entry/useSignInCredentialsForm";
import {
  persistRememberedLoginEmail,
  readRememberedLoginEmail,
  readRememberMeEnabled,
} from "./loginRememberEmail";

export function useTenantLoginController() {
  const { login, isAuthenticated, exchangeHandoff, user } = useAuth();
  const settings = useGlobalSettings();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const redirectTo = (location.state as { from?: string } | null)?.from ?? DEFAULT_AUTH_REDIRECT;

  const credentials = useSignInCredentialsForm({
    initialEmail: readRememberedLoginEmail(),
    t,
  });

  const rememberFieldId = `${credentials.formId}-remember`;
  const [rememberMe, setRememberMe] = useState<boolean>(readRememberMeEnabled);
  const [loading, setLoading] = useState<boolean>(false);
  // Lazy initialise from the URL: a handoff link starts processing on the very first render.
  const [handoffProcessing, setHandoffProcessing] = useState<boolean>(
    () => !isAuthenticated && Boolean(new URLSearchParams(location.search).get("handoff")),
  );

  useEffect(() => {
    if (!isAuthenticated) return;
    const needs2FA = requiresTwoFactor(settings, user) && !is2FAVerified();
    if (!needs2FA) {
      const dest = user?.mustChangePassword ? ROUTES.forcePasswordChange : redirectTo;
      navigate(dest, { replace: true });
    }
  }, [isAuthenticated, user, settings, navigate, redirectTo]);

  useEffect(() => {
    const handoff = new URLSearchParams(location.search).get("handoff");
    if (!handoff || isAuthenticated) return;

    credentials.setError("");
    void exchangeHandoff(handoff)
      .catch((err: unknown) => {
        credentials.setError(getAuthErrorMessage(err, t));
      })
      .finally(() => setHandoffProcessing(false));
  }, [location.search, exchangeHandoff, isAuthenticated, credentials, t]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!credentials.validate()) return;
    setLoading(true);
    const trimmedEmail = credentials.email.trim();
    try {
      const { user: loggedInUser, requires2FA } = await login(trimmedEmail, credentials.password);
      persistRememberedLoginEmail(trimmedEmail, rememberMe);
      if (requires2FA) {
        navigate(ROUTES.twoFactor, { replace: true, state: { from: redirectTo } });
        return;
      }
      clear2FAState();
      mark2FAVerified();
      const dest = loggedInUser.mustChangePassword ? ROUTES.forcePasswordChange : redirectTo;
      navigate(dest, { replace: true });
    } catch (err: unknown) {
      credentials.setError(getAuthErrorMessage(err, t));
    } finally {
      setLoading(false);
    }
  };

  const handleRememberMeChange = (checked: boolean | "indeterminate"): void => {
    const shouldRememberEmail = checked === true;
    setRememberMe(shouldRememberEmail);
    if (!shouldRememberEmail) {
      persistRememberedLoginEmail("", false);
    }
  };

  const isBusy = loading || handoffProcessing;

  return {
    ...credentials,
    rememberFieldId,
    rememberMe,
    loading,
    handoffProcessing,
    isBusy,
    location,
    t,
    handleSubmit,
    handleRememberMeChange,
  };
}
