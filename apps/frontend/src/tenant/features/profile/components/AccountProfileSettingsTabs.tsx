import React, { useState } from "react";
import { Lock, User } from "lucide-react";
import type { TenantUserProfile } from "@mms/shared";
import { SubTabBar } from "@/components/ui/SubTabBar";
import { useTranslation } from "@/hooks/useTranslation";
import { AccountProfileContactTab } from "./AccountProfileContactTab";
import { AccountProfileSecurityTab } from "./AccountProfileSecurityTab";

interface AccountProfileSettingsTabsProps {
  profile: TenantUserProfile;
  loginVerified: boolean;
  name: string;
  phone: string;
  contactEmail: string;
  savingContact: boolean;
  newLoginEmail: string;
  loginPassword: string;
  challengeId: string | null;
  verifyCode: string;
  devCode: string | null;
  loginEmailBusy: boolean;
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
  passwordBusy: boolean;
  showEmailForm: boolean;
  showPasswordForm: boolean;
  onNameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onContactEmailChange: (value: string) => void;
  onSaveContact: () => Promise<void>;
  onNewLoginEmailChange: (value: string) => void;
  onLoginPasswordChange: (value: string) => void;
  onVerifyCodeChange: (value: string) => void;
  onShowEmailForm: () => void;
  onCancelLoginEmailRequest: () => void;
  onCancelLoginEmailConfirm: () => void;
  onRequestLoginEmail: () => Promise<void>;
  onConfirmLoginEmail: () => Promise<void>;
  onCurrentPasswordChange: (value: string) => void;
  onNewPasswordChange: (value: string) => void;
  onConfirmPasswordChange: (value: string) => void;
  onShowPasswordForm: () => void;
  onCancelPasswordChange: () => void;
  onChangePassword: () => Promise<void>;
}

export function AccountProfileSettingsTabs({
  profile,
  loginVerified,
  name,
  phone,
  contactEmail,
  savingContact,
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
  onNameChange,
  onPhoneChange,
  onContactEmailChange,
  onSaveContact,
  onNewLoginEmailChange,
  onLoginPasswordChange,
  onVerifyCodeChange,
  onShowEmailForm,
  onCancelLoginEmailRequest,
  onCancelLoginEmailConfirm,
  onRequestLoginEmail,
  onConfirmLoginEmail,
  onCurrentPasswordChange,
  onNewPasswordChange,
  onConfirmPasswordChange,
  onShowPasswordForm,
  onCancelPasswordChange,
  onChangePassword,
}: AccountProfileSettingsTabsProps): React.JSX.Element {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState<"profile" | "security">("profile");

  const tabs = (() => [
    { key: "profile" as const, label: t("account.contactSection"), icon: User },
    { key: "security" as const, label: t("account.loginSection"), icon: Lock },
  ])();

  return (
    <div className="w-full">
      <SubTabBar
        tabs={tabs}
        value={activeTab}
        onChange={setActiveTab}
        panelIdPrefix="account-profile"
        className="mb-8 justify-center"
      />

      {activeTab === "profile" ? (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 focus-visible:outline-none">
          <AccountProfileContactTab
            profile={profile}
            name={name}
            phone={phone}
            contactEmail={contactEmail}
            savingContact={savingContact}
            onNameChange={onNameChange}
            onPhoneChange={onPhoneChange}
            onContactEmailChange={onContactEmailChange}
            onSaveContact={onSaveContact}
          />
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-3 duration-300 focus-visible:outline-none">
          <AccountProfileSecurityTab
            profile={profile}
            loginVerified={loginVerified}
            newLoginEmail={newLoginEmail}
            loginPassword={loginPassword}
            challengeId={challengeId}
            verifyCode={verifyCode}
            devCode={devCode}
            loginEmailBusy={loginEmailBusy}
            currentPassword={currentPassword}
            newPassword={newPassword}
            confirmPassword={confirmPassword}
            passwordBusy={passwordBusy}
            showEmailForm={showEmailForm}
            showPasswordForm={showPasswordForm}
            onNewLoginEmailChange={onNewLoginEmailChange}
            onLoginPasswordChange={onLoginPasswordChange}
            onVerifyCodeChange={onVerifyCodeChange}
            onShowEmailForm={onShowEmailForm}
            onCancelLoginEmailRequest={onCancelLoginEmailRequest}
            onCancelLoginEmailConfirm={onCancelLoginEmailConfirm}
            onRequestLoginEmail={onRequestLoginEmail}
            onConfirmLoginEmail={onConfirmLoginEmail}
            onCurrentPasswordChange={onCurrentPasswordChange}
            onNewPasswordChange={onNewPasswordChange}
            onConfirmPasswordChange={onConfirmPasswordChange}
            onShowPasswordForm={onShowPasswordForm}
            onCancelPasswordChange={onCancelPasswordChange}
            onChangePassword={onChangePassword}
          />
        </div>
      )}
    </div>
  );
}
