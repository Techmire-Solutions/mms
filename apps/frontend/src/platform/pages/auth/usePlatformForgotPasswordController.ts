import type React from "react";
import { useId, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  getPlatformPasswordError,
  getPlatformPasswordMatchError,
} from "@/platform/lib/platformValidation";
import { createEmptyOtp, isOtpComplete } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { useResendCountdown } from "@/hooks/useResendCountdown";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { ROUTES } from "@/lib/config/routes";
import { usePlatformAuth } from "@/platform/lib/PlatformAuthContext";
import {
  usePlatformPasswordForgot,
  usePlatformPasswordReset,
  usePlatformPasswordResetResend,
} from "@/platform/hooks/usePlatformAuthActions";
import { focusAuthField, validateAuthEmail } from "@/components/entry";
import { ApiError } from "@/lib/apiClient";

export function usePlatformForgotPasswordController() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { checkPlatformAuth } = usePlatformAuth();
  const formId = useId();
  const emailFieldId = `${formId}-email`;
  const newPasswordId = `${formId}-new-password`;
  const confirmPasswordId = `${formId}-confirm-password`;

  const forgotMutation = usePlatformPasswordForgot();
  const resetMutation = usePlatformPasswordReset();
  const resendMutation = usePlatformPasswordResetResend();

  const resetIdParam = searchParams.get("resetId")?.trim() ?? "";
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [resetId, setResetId] = useState(resetIdParam);
  const [code, setCode] = useState(createEmptyOtp);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [devHint, setDevHint] = useState<string | null>(null);

  const loading = forgotMutation.isPending || resetMutation.isPending || resendMutation.isPending;
  const isResetStep = Boolean(resetId);
  const [resendCycle, setResendCycle] = useState(0);
  const resendCountdown = useResendCountdown(isResetStep, 30, resendCycle);

  // Adopt a reset id that arrives through the URL during render.
  const [prevResetIdParam, setPrevResetIdParam] = useState(resetIdParam);
  if (prevResetIdParam !== resetIdParam) {
    setPrevResetIdParam(resetIdParam);
    if (resetIdParam) setResetId(resetIdParam);
  }

  const resetPath = (passwordResetId: string): string =>
    `${ROUTES.platformForgotPassword}?resetId=${encodeURIComponent(passwordResetId)}`;

  const handleRequest = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);
    setDevHint(null);

    const fieldError = validateAuthEmail(email, t);
    if (fieldError) {
      setEmailError(fieldError);
      focusAuthField(emailFieldId);
      return;
    }
    setEmailError(undefined);

    try {
      const result = await forgotMutation.mutateAsync({ email: email.trim() });
      setSent(true);
      if (result.devReset) {
        setDevHint(
          t("platform.forgotDevResetHint", {
            code: result.devReset.code,
            resetId: result.devReset.resetId,
          }),
        );
        setResetId(result.devReset.resetId);
      }
    } catch (err) {
      setError(getPlatformErrorMessage(err, t));
    }
  };

  const handleReset = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    if (!resetId) return;

    const matchError = getPlatformPasswordMatchError(password, confirmPassword, t);
    if (matchError) {
      setError(matchError);
      return;
    }

    const passwordError = getPlatformPasswordError(password, t);
    if (passwordError) {
      setError(passwordError);
      return;
    }

    if (!isOtpComplete(code)) {
      setError(t("auth.otpIncomplete"));
      return;
    }

    setError(null);
    try {
      await resetMutation.mutateAsync({
        resetId,
        code: code.join(""),
        password,
      });
      await checkPlatformAuth();
      navigate(ROUTES.home, { replace: true });
    } catch (err) {
      setError(getPlatformErrorMessage(err, t));
      if (
        err instanceof ApiError &&
        (err.type === "too_many_attempts" || err.type === "invalid_reset")
      ) {
        setResetId("");
        setCode(createEmptyOtp());
        setSent(false);
        navigate(ROUTES.platformForgotPassword, { replace: true });
      }
    }
  };

  const handleResend = async (): Promise<void> => {
    if (!resetId || resendCountdown > 0) return;
    setError(null);
    try {
      const result = await resendMutation.mutateAsync(resetId);
      if (result.devReset) {
        setDevHint(
          t("platform.forgotDevResetHint", {
            code: result.devReset.code,
            resetId: result.devReset.resetId,
          }),
        );
      }
      setResendCycle((value) => value + 1);
    } catch (err) {
      setError(getPlatformErrorMessage(err, t));
      if (
        err instanceof ApiError &&
        (err.type === "too_many_attempts" || err.type === "invalid_reset")
      ) {
        setResetId("");
        setCode(createEmptyOtp());
        setSent(false);
        navigate(ROUTES.platformForgotPassword, { replace: true });
      }
    }
  };

  const forgotTitle = isResetStep
    ? t("platform.forgotResetTitle")
    : sent
      ? t("auth.forgotCheckEmail")
      : t("platform.forgotTitle");

  return {
    t,
    navigate,
    emailFieldId,
    newPasswordId,
    confirmPasswordId,
    email,
    setEmail,
    sent,
    setSent,
    resetId,
    code,
    setCode,
    password,
    setPassword,
    confirmPassword,
    setConfirmPassword,
    error,
    setError,
    emailError,
    setEmailError,
    devHint,
    setDevHint,
    loading,
    isResetStep,
    resendCountdown,
    forgotTitle,
    resetPath,
    handleRequest,
    handleReset,
    handleResend,
  };
}

export type PlatformForgotPasswordController = ReturnType<
  typeof usePlatformForgotPasswordController
>;
