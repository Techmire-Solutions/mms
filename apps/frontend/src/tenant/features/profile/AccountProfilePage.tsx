import React, { Suspense, type JSX } from "react";
import { User } from "lucide-react";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { ErrorState } from "@/components/app/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import { AccountProfileHeaderCard } from "@/tenant/features/profile/components/AccountProfileHeaderCard";
import { AccountProfileSettingsTabs } from "@/tenant/features/profile/components/AccountProfileSettingsTabs";
import { useAccountProfilePageController } from "@/tenant/features/profile/hooks/useAccountProfilePageController";

const AvatarCropper = React.lazy(() =>
  import("@/components/app/AvatarCropper").then((m) => ({ default: m.AvatarCropper })),
);

export default function AccountProfile(): JSX.Element {
  const c = useAccountProfilePageController();

  return (
    <ModulePageShell
      seoTitle={`MMS - ${c.t("account.title")}`}
      seoDescription={c.t("account.subtitle")}
      headerIcon={User}
      headerTitle={c.t("account.title")}
      headerSubtitle={c.t("account.subtitle")}
    >
      {c.isLoading ? (
        <div className="space-y-6 animate-pulse" role="status" aria-live="polite" aria-busy="true">
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-center gap-4">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2 flex-1">
                <Skeleton className="h-5 w-48 rounded" />
                <Skeleton className="h-4 w-32 rounded" />
              </div>
            </div>
            <Skeleton className="h-2 w-full rounded-full" />
          </div>
          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <div className="flex gap-2 border-b border-border pb-3">
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-lg" />
              <Skeleton className="h-9 w-28 rounded-lg" />
            </div>
            <div className="space-y-3 pt-2">
              <Skeleton className="h-10 w-full rounded-xl" />
              <Skeleton className="h-10 w-full rounded-xl" />
            </div>
          </div>
        </div>
      ) : c.isError ? (
        <ErrorState
          title={c.t("account.loadFailed")}
          description={c.t("account.loadFailedHint")}
          onRetry={() => {
            void c.refetch();
          }}
        />
      ) : c.profile ? (
        <div className="space-y-6 animate-in fade-in-50 duration-200">
          <AccountProfileHeaderCard
            profile={c.profile}
            name={c.name}
            completeness={c.completeness}
            avatarGradient={c.avatarGradient}
            fileInputRef={c.fileInputRef}
            onFileChange={c.handleFileChange}
          />

          <AccountProfileSettingsTabs
            profile={c.profile}
            loginVerified={c.loginVerified}
            name={c.name}
            phone={c.phone}
            contactEmail={c.contactEmail}
            savingContact={c.savingContact}
            newLoginEmail={c.newLoginEmail}
            loginPassword={c.loginPassword}
            challengeId={c.challengeId}
            verifyCode={c.verifyCode}
            devCode={c.devCode}
            loginEmailBusy={c.loginEmailBusy}
            currentPassword={c.currentPassword}
            newPassword={c.newPassword}
            confirmPassword={c.confirmPassword}
            passwordBusy={c.passwordBusy}
            showEmailForm={c.showEmailForm}
            showPasswordForm={c.showPasswordForm}
            onNameChange={c.setName}
            onPhoneChange={c.setPhone}
            onContactEmailChange={c.setContactEmail}
            onSaveContact={c.handleSaveContact}
            onNewLoginEmailChange={c.setNewLoginEmail}
            onLoginPasswordChange={c.setLoginPassword}
            onVerifyCodeChange={c.setVerifyCode}
            onShowEmailForm={() => c.setShowEmailForm(true)}
            onCancelLoginEmailRequest={c.handleCancelLoginEmailRequest}
            onCancelLoginEmailConfirm={c.handleCancelLoginEmailConfirm}
            onRequestLoginEmail={c.handleRequestLoginEmail}
            onConfirmLoginEmail={c.handleConfirmLoginEmail}
            onCurrentPasswordChange={c.setCurrentPassword}
            onNewPasswordChange={c.setNewPassword}
            onConfirmPasswordChange={c.setConfirmPassword}
            onShowPasswordForm={() => c.setShowPasswordForm(true)}
            onCancelPasswordChange={c.handleCancelPasswordChange}
            onChangePassword={c.handleChangePassword}
          />
        </div>
      ) : null}

      {c.showCropper && (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-modal flex items-center justify-center p-4 bg-background/80 backdrop-blur-xs">
              <Skeleton className="w-full max-w-md h-96 rounded-2xl" />
            </div>
          }
        >
          <AvatarCropper
            src={c.showCropper}
            onCrop={c.handleAvatarCrop}
            onCancel={() => c.setShowCropper(null)}
          />
        </Suspense>
      )}
    </ModulePageShell>
  );
}
