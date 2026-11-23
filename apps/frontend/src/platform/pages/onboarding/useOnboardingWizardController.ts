import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  isValidSubdomain,
  isValidEmail,
  validatePasswordPolicy,
} from "@mms/shared";
import { ROUTES } from "@/lib/config/routes";
import { applyBrandingTheme } from "@/lib/brandingTheme";
import { useAuth } from "@/lib/contexts/AuthContext";
import { useTranslation } from "@/hooks/useTranslation";
import { isApiError } from "@/lib/apiClient";
import { notify } from "@/lib/notify";
import { getPlatformErrorMessage } from "@/platform/lib/platformAuthErrors";
import { PLATFORM_QUERY_KEYS } from "@/platform/lib/platformQueryKeys";
import {
  ONBOARDING_INITIAL_DATA,
  ONBOARDING_STEP_DEFS,
  type OnboardingData,
} from "@/platform/pages/onboarding/onboardingWizardTypes";

export function useOnboardingWizardController() {
  const { onboard } = useAuth();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [data, setData] = useState<OnboardingData>(ONBOARDING_INITIAL_DATA);
  const [loading, setLoading] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showSignInLink, setShowSignInLink] = useState(false);

  const wizardSteps = ONBOARDING_STEP_DEFS.map((def) => ({ id: def.id, label: t(def.labelKey) }));

  useEffect(() => {
    return () => {
      applyBrandingTheme();
    };
  }, []);

  const currentStep = ONBOARDING_STEP_DEFS[step - 1];
  if (!currentStep) {
    throw new Error(`Invalid step state: step ${step} does not exist.`);
  }

  const isLastStep = step === ONBOARDING_STEP_DEFS.length;

  /** Temporary-password mode must satisfy the new workspace's default policy. */
  const validateTemporaryPassword = (): string | null => {
    if (data.adminPasswordMode !== "temporary") return null;
    const password = data.password ?? "";
    if (!password.trim()) return t("onboarding.errorPasswordRequired");
    const policy = validatePasswordPolicy(password, DEFAULT_GLOBAL_SETTINGS.passwordPolicy);
    if (!policy.valid) return policy.errorKey ? t(policy.errorKey) : policy.message;
    if ((data.passwordConfirm ?? "") !== password) return t("onboarding.errorPasswordMismatch");
    return null;
  };

  const validateCurrentStep = (): string | null => {
    if (step === 1) {
      if (!data.name.trim()) return t("onboarding.errorMadrasaName");
      if (!data.subdomain || !isValidSubdomain(data.subdomain))
        return t("onboarding.errorSubdomain");
    }
    if (step === 2 && data.modules.length === 0) {
      return t("onboarding.errorModules");
    }
    if (step === 4) {
      if (!data.firstName.trim() || !data.lastName.trim()) return t("onboarding.errorAdminName");
      if (!isValidEmail(data.email)) return t("onboarding.errorAdminEmail");
      if (!data.adminGender) return t("onboarding.errorAdminGender");
      const passwordError = validateTemporaryPassword();
      if (passwordError) return passwordError;
    }
    return null;
  };

  const handleFinish = async (): Promise<void> => {
    setSubmitError(null);
    setShowSignInLink(false);

    const stepError = validateCurrentStep();
    if (stepError) {
      setSubmitError(stepError);
      return;
    }

    if (!data.adminGender) {
      setSubmitError(t("onboarding.errorAdminGender"));
      return;
    }

    const passwordError = validateTemporaryPassword();
    if (passwordError) {
      setSubmitError(passwordError);
      return;
    }

    if (!data.currentPassword.trim()) {
      setSubmitError(t("platform.validationConfirmPlatformPassword"));
      return;
    }

    setLoading(true);

    try {
      const onboardResult = await onboard({
        madrasaName: data.name.trim(),
        tagline: DEFAULT_BRANDING_SETTINGS.tagline,
        adminName: `${data.firstName} ${data.lastName}`.trim(),
        email: data.email,
        adminGender: data.adminGender,
        adminPasswordMode: data.adminPasswordMode,
        password: data.adminPasswordMode === "temporary" ? data.password : undefined,
        currentPassword: data.currentPassword,
        subdomain: data.subdomain,
        modules: data.modules,
        industryType: data.industryType,
      });

      if (data.adminPasswordMode === "email") {
        if (onboardResult.inviteEmailSent === false) {
          notify.warning(t("onboarding.emailFailedTitle"), {
            description: onboardResult.inviteEmailError || t("onboarding.emailFailedDesc"),
          });
        } else {
          notify.success(t("onboarding.emailSentToast"), {
            description: t("onboarding.emailSentToastDesc"),
          });
        }
      } else {
        notify.success(t("platform.workspaceCreatedToast"), {
          description: data.subdomain,
        });
      }
      void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.workspaces });
      void queryClient.invalidateQueries({ queryKey: PLATFORM_QUERY_KEYS.workspaceRegistry });

      navigate(ROUTES.platformWorkspaces, { replace: true });
    } catch (err: unknown) {
      if (isApiError(err) && err.type === "conflict") {
        setSubmitError(t("onboarding.workspaceConflict"));
        setShowSignInLink(true);
      } else {
        setSubmitError(getPlatformErrorMessage(err, t));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleBack = (): void => {
    // A failed step's error must not follow the user back to an earlier step.
    setSubmitError(null);
    setShowSignInLink(false);
    setStep((value) => Math.max(1, value - 1));
  };

  const handleNext = (): void => {
    const stepError = validateCurrentStep();
    if (stepError) {
      setSubmitError(stepError);
      setShowSignInLink(false);
      return;
    }
    setSubmitError(null);
    setShowSignInLink(false);

    if (!isLastStep) {
      setStep((value) => value + 1);
      return;
    }
    void handleFinish();
  };

  return {
    t,
    step,
    setStep,
    data,
    setData,
    loading,
    submitError,
    wizardSteps,
    currentStep,
    isLastStep,
    handleNext,
    handleBack,
    showSignInLink,
  };
}
