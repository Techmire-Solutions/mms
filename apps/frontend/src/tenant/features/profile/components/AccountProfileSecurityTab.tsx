import type React from "react";
import type { TenantUserProfile } from "@mms/shared";
import { AccountProfileLoginEmailCard } from "./AccountProfileLoginEmailCard";
import { AccountProfilePasswordCard } from "./AccountProfilePasswordCard";

export interface AccountProfileSecurityTabProps {
  profile: TenantUserProfile;
  loginVerified: boolean;
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

export function AccountProfileSecurityTab({
  profile,
  loginVerified,
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
}: AccountProfileSecurityTabProps): React.JSX.Element {
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <AccountProfileLoginEmailCard
        profile={profile}
        loginVerified={loginVerified}
        newLoginEmail={newLoginEmail}
        loginPassword={loginPassword}
        challengeId={challengeId}
        verifyCode={verifyCode}
        devCode={devCode}
        loginEmailBusy={loginEmailBusy}
        showEmailForm={showEmailForm}
        onNewLoginEmailChange={onNewLoginEmailChange}
        onLoginPasswordChange={onLoginPasswordChange}
        onVerifyCodeChange={onVerifyCodeChange}
        onShowEmailForm={onShowEmailForm}
        onCancelLoginEmailRequest={onCancelLoginEmailRequest}
        onCancelLoginEmailConfirm={onCancelLoginEmailConfirm}
        onRequestLoginEmail={onRequestLoginEmail}
        onConfirmLoginEmail={onConfirmLoginEmail}
      />

      <AccountProfilePasswordCard
        currentPassword={currentPassword}
        newPassword={newPassword}
        confirmPassword={confirmPassword}
        passwordBusy={passwordBusy}
        showPasswordForm={showPasswordForm}
        onCurrentPasswordChange={onCurrentPasswordChange}
        onNewPasswordChange={onNewPasswordChange}
        onConfirmPasswordChange={onConfirmPasswordChange}
        onShowPasswordForm={onShowPasswordForm}
        onCancelPasswordChange={onCancelPasswordChange}
        onChangePassword={onChangePassword}
      />
    </div>
  );
}
