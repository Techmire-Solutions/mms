import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DEFAULT_GLOBAL_SETTINGS, validatePasswordPolicy } from "@mms/shared";
import { useGlobalSettings } from "@/tenant/hooks/useGlobalSettings";
import { createEmptyOtp, isOtpComplete } from "@/components/app/OtpInput";
import { useResendCountdown } from "@/hooks/useResendCountdown";
import { ROUTES } from "@/lib/config/routes";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuth } from "@/lib/contexts/AuthContext";
import { isApiError } from "@/lib/apiClient";
import { notify } from "@/lib/notify";
import { focusAuthField, validateAuthEmail } from "@/components/entry";

export type ForgotPasswordView = "email" | "otp" | "reset";
export type ForgotPasswordFlow = "reset" | "activate";

export function useForgotPasswordState(emailFieldId: string) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const settings = useGlobalSettings();
  const activePolicy = settings.passwordPolicy ?? DEFAULT_GLOBAL_SETTINGS.passwordPolicy;
  const [searchParams] = useSearchParams();
  const { requestPasswordOtp, verifyPasswordOtp, resetPasswordWithOtp } = useAuth();

  const [view, setView] = useState<ForgotPasswordView>("email");
  const [flow, setFlow] = useState<ForgotPasswordFlow>(() =>
    searchParams.get("activate") ? "activate" : "reset",
  );
  const [email, setEmail] = useState(() => searchParams.get("email")?.trim() || "");
  const [code, setCode] = useState(createEmptyOtp);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCycle, setResendCycle] = useState(0);

  const resendCountdown = useResendCountdown(view === "otp", 60, resendCycle);

  useEffect(() => {
    if (searchParams.get("activate")) {
      setFlow("activate");
    }
    const emailParam = searchParams.get("email")?.trim();
    if (emailParam) {
      setEmail((prev) => prev || emailParam);
    }
  }, [searchParams]);

  const handleRequestCode = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    const emailError = validateAuthEmail(email, t);
    if (emailError) {
      setError(emailError);
      focusAuthField(emailFieldId);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await requestPasswordOtp(email.trim());
      setView("otp");
    } catch (requestError: unknown) {
      setError(isApiError(requestError) ? requestError.message : t("errors.module.description"));
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async (): Promise<void> => {
    setLoading(true);
    try {
      await requestPasswordOtp(email.trim());
      setResendCycle((cycle) => cycle + 1);
      setError("");
      setCode(createEmptyOtp());
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (!isOtpComplete(code)) {
      setError(t("auth.otpIncomplete"));
      return;
    }
    setLoading(true);
    setError("");
    try {
      await verifyPasswordOtp(email.trim(), code.join(""));
      setView("reset");
    } catch {
      setError(t("auth.otpInvalid"));
      setCode(createEmptyOtp());
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError(t("auth.forgotPasswordMismatch"));
      return;
    }
    const policy = validatePasswordPolicy(password, activePolicy);
    if (!policy.valid) {
      setError(policy.errorKey ? t(policy.errorKey) : policy.message);
      return;
    }
    setLoading(true);
    setError("");
    try {
      await resetPasswordWithOtp(email.trim(), code.join(""), password);
      notify.success(t("auth.passwordSetSuccess"));
      navigate(ROUTES.home, { replace: true });
    } catch (resetError: unknown) {
      setError(isApiError(resetError) ? resetError.message : t("errors.module.description"));
    } finally {
      setLoading(false);
    }
  };

  const title =
    view === "otp"
      ? t("auth.forgotEnterCodeTitle")
      : view === "reset"
        ? flow === "activate"
          ? t("auth.forgotActivatePasswordTitle")
          : t("auth.forgotNewPasswordTitle")
        : flow === "activate"
          ? t("auth.forgotActivateTitle")
          : t("auth.forgotTitle");

  const subtitle =
    view === "email"
      ? flow === "activate"
        ? t("auth.forgotActivateSubtitle")
        : t("auth.forgotSubtitle")
      : view === "otp"
        ? t("auth.codeSentTo") + " " + email
        : undefined;

  return {
    view,
    flow,
    email,
    setEmail,
    code,
    setCode,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    loading,
    error,
    setError,
    activePolicy,
    resendCountdown,
    handleRequestCode,
    handleResend,
    handleVerifyCode,
    handleSetPassword,
    title,
    subtitle,
    t,
  };
}
