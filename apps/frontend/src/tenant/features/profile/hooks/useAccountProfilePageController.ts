import { useRef, useState, type ChangeEvent } from "react";
import { calculateProfileCompleteness, type FieldConfig } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { useTenantProfile } from "@/tenant/hooks/useTenantProfile";
import { genderAvatarGradient } from "@/lib/ui/semanticTone";
import { useAccountProfileContactActions } from "@/tenant/features/profile/hooks/useAccountProfileContactActions";
import { useAccountProfileSecurityActions } from "@/tenant/features/profile/hooks/useAccountProfileSecurityActions";

export function useAccountProfilePageController() {
  const { t } = useTranslation();
  const { data: profile, isLoading, isError, refetch } = useTenantProfile();
  const contact = useAccountProfileContactActions();
  const security = useAccountProfileSecurityActions();

  const [showCropper, setShowCropper] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loginVerified = (() => Boolean(profile?.emailVerifiedAt))();

  const completeness = (() => {
    if (!profile?.contact) return 0;
    return calculateProfileCompleteness(profile.contact, {
      fields: {},
      version: 1,
      enabledTabs: [],
      requiredTabs: [],
    } satisfies FieldConfig);
  })();

  const avatarGradient = (() => {
    return genderAvatarGradient(profile?.contact?.gender ?? "");
  })();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setShowCropper(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleAvatarCrop = async (url: string) => {
    await contact.handleAvatarCrop(url);
    setShowCropper(null);
  };

  return {
    t,
    profile,
    isLoading,
    isError,
    refetch,
    ...contact,
    ...security,
    showCropper,
    setShowCropper,
    fileInputRef,
    loginVerified,
    completeness,
    avatarGradient,
    handleFileChange,
    handleAvatarCrop,
  };
}
