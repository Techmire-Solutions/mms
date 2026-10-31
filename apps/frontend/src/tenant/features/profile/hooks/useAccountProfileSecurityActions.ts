import { useState } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { useTenantProfile, TENANT_PROFILE_KEY } from "@/tenant/hooks/useTenantProfile";
import { notify } from "@/lib/notify";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  changePasswordBodySchema,
  requestLoginEmailChangeBodySchema,
  confirmLoginEmailChangeBodySchema,
} from "@mms/shared";
import { tsrClient } from "@/lib/api";
import { apiContractError, assertContractOk } from "@/lib/apiContractError";

export function useAccountProfileSecurityActions() {
  const { t } = useTranslation();
  const { checkUserAuth } = useAuth();
  const queryClient = useQueryClient();
  const { refetch } = useTenantProfile();

  const [newLoginEmail, setNewLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [loginEmailBusy, setLoginEmailBusy] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  const requestLoginEmailMutation = tsrClient.auth.requestLoginEmail.useMutation();
  const confirmLoginEmailMutation = tsrClient.auth.confirmLoginEmail.useMutation();
  const changePasswordMutation = tsrClient.auth.changePassword.useMutation();

  const handleRequestLoginEmail = async (): Promise<void> => {
    setLoginEmailBusy(true);
    setDevCode(null);
    try {
      const payload = {
        newLoginEmail: newLoginEmail.trim(),
        currentPassword: loginPassword,
      };
      const checked = requestLoginEmailChangeBodySchema.safeParse(payload);
      if (!checked.success) {
        notify.error(t("common.formPleaseFixErrors"));
        return;
      }
      const { status, body } = await requestLoginEmailMutation.mutateAsync({
        body: checked.data,
      });
      if (status !== 200) {
        throw apiContractError(
          { status },
          status === 401 ? t("account.wrongPassword") : t("errors.boundary.description"),
        );
      }
      setChallengeId(body.challengeId);
      if (body.devCode) setDevCode(body.devCode);
      notify.success(t("account.sendCode"));
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message || t("errors.boundary.description")
          : t("errors.boundary.description");
      notify.error(message);
    } finally {
      setLoginEmailBusy(false);
    }
  };

  const handleConfirmLoginEmail = async (): Promise<void> => {
    if (!challengeId) return;
    setLoginEmailBusy(true);
    try {
      const checked = confirmLoginEmailChangeBodySchema.safeParse({
        challengeId,
        code: verifyCode,
      });
      if (!checked.success) {
        notify.error(t("common.formPleaseFixErrors"));
        return;
      }
      const { status } = await confirmLoginEmailMutation.mutateAsync({
        body: checked.data,
      });
      assertContractOk({ status }, t("errors.boundary.description"));
      setChallengeId(null);
      setVerifyCode("");
      setNewLoginEmail("");
      setLoginPassword("");
      setDevCode(null);
      await checkUserAuth();
      await queryClient.invalidateQueries({ queryKey: TENANT_PROFILE_KEY });
      await refetch();
      notify.success(t("account.loginEmailChanged"));
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message || t("errors.boundary.description")
          : t("errors.boundary.description");
      notify.error(message);
    } finally {
      setLoginEmailBusy(false);
    }
  };

  const handleChangePassword = async (): Promise<void> => {
    if (newPassword !== confirmPassword) {
      notify.error(t("account.passwordMismatch"));
      return;
    }
    setPasswordBusy(true);
    try {
      const checked = changePasswordBodySchema.safeParse({
        currentPassword,
        newPassword,
      });
      if (!checked.success) {
        notify.error(t("common.formPleaseFixErrors"));
        return;
      }
      const { status } = await changePasswordMutation.mutateAsync({
        body: checked.data,
      });
      if (status !== 200) {
        throw apiContractError(
          { status },
          status === 401 ? t("account.wrongPassword") : t("errors.boundary.description"),
        );
      }
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      notify.success(t("account.passwordChanged"));
    } catch (error: unknown) {
      const message =
        error instanceof Error
          ? error.message || t("errors.boundary.description")
          : t("errors.boundary.description");
      notify.error(message);
    } finally {
      setPasswordBusy(false);
    }
  };

  const handleCancelLoginEmailRequest = (): void => {
    setShowEmailForm(false);
    setNewLoginEmail("");
    setLoginPassword("");
  };

  const handleCancelLoginEmailConfirm = (): void => {
    setShowEmailForm(false);
    setNewLoginEmail("");
    setLoginPassword("");
    setChallengeId(null);
    setVerifyCode("");
  };

  const handleCancelPasswordChange = (): void => {
    setShowPasswordForm(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
  };

  return {
    newLoginEmail,
    loginPassword,
    challengeId,
    verifyCode,
    devCode,
    loginEmailBusy,
    currentPassword,
    newPassword,
    confirmPassword,
    passwordBusy,
    showEmailForm,
    showPasswordForm,
    setNewLoginEmail,
    setLoginPassword,
    setVerifyCode,
    setCurrentPassword,
    setNewPassword,
    setConfirmPassword,
    setShowEmailForm,
    setShowPasswordForm,
    handleRequestLoginEmail,
    handleConfirmLoginEmail,
    handleChangePassword,
    handleCancelLoginEmailRequest,
    handleCancelLoginEmailConfirm,
    handleCancelPasswordChange,
  };
}
