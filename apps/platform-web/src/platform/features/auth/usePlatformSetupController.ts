import type React from "react";
import { useState } from "react";
import { getPlatformRegisterError } from "@/platform/features/shell/lib/platformValidation";
import { formatEntryTitle } from "@/components/entry";
import { useTranslation } from "@mms/fe-core/i18n";
import { getPlatformErrorMessage } from "@/platform/features/auth/lib/platformAuthErrors";
import { usePlatformAuth } from "@/platform/features/auth/lib/PlatformAuthContext";
import { useInvalidatePlatformSetupStatus } from "@/platform/features/auth/hooks/usePlatformSetupStatus";
import { usePlatformSetupRegister } from "@/platform/features/auth/hooks/usePlatformAuthActions";

export function usePlatformSetupController(_smtpConfigured: boolean) {
  const { t } = useTranslation();
  const checkPlatformAuth = usePlatformAuth().checkPlatformAuth;
  const invalidateSetupStatus = useInvalidatePlatformSetupStatus();

  const registerMutation = usePlatformSetupRegister();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  const loading = registerMutation.isPending;

  const pageTitle = formatEntryTitle(t("platform.setupTitle"), t("entry.productName"));

  const handleRegister = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault();
    setError(null);

    const validationError = getPlatformRegisterError(name, email, password, t);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      await registerMutation.mutateAsync({
        name: name.trim(),
        email: email.trim(),
        password,
      });
      invalidateSetupStatus();
      await checkPlatformAuth();
    } catch (err) {
      setError(getPlatformErrorMessage(err, t));
    }
  };

  const clearError = () => setError(null);

  return {
    t,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    error,
    loading,
    pageTitle,
    handleRegister,
    clearError,
  };
}
