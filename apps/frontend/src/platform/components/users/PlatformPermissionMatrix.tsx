import { PLATFORM_PERMISSION_CONFIG } from "@/platform/lib/platformPermissionConfig";
import React from "react";
import { Check, X, Shield } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { usePlatformPermissionMatrix } from "@/platform/hooks/usePlatformPermissionMatrix";
import { WorkBatchTable, type WorkBatchTableColumn } from "@/components/common/work/WorkBatchTable";
import { ErrorState } from "@/components/app/ErrorState";
import type { PlatformUserProfile } from "@mms/shared";
import { SearchBar } from "@/components/app/SearchBar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/app/EmptyState";
import { CardSkeleton } from "@/components/app/LoadingState";
import { FormModal } from "@/components/app/FormModal";
import { Field } from "@/components/app/FormField";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function PlatformPermissionMatrix(): React.JSX.Element {
  const { t } = useTranslation();
  const {
    filteredAdmins,
    isLoading,
    isError,
    retry,
    isSuperUser,
    currentUser,
    search,
    setSearch,
    handleToggle,
    busy,
    pendingToggle,
    stepUpPassword,
    setStepUpPassword,
    stepUpError,
    cancelStepUp,
    confirmStepUp,
  } = usePlatformPermissionMatrix();

  if (isLoading) return <CardSkeleton count={2} />;

  if (isError)
    return (
      <ErrorState
        onRetry={() => {
          void retry();
        }}
        description={t("errors.state.generic")}
      />
    );

  const columns: WorkBatchTableColumn<PlatformUserProfile>[] = [
    {
      id: "name",
      label: t("platform.descriptor.user.name"),
      render: (admin) => (
        <div>
          <div className="font-semibold">{admin.name}</div>
          <div className="text-muted-foreground">{admin.email}</div>
        </div>
      ),
    },
    {
      id: "role",
      label: t("platform.descriptor.user.role"),
      render: (admin) => (
        <Badge variant={admin.role === "super_user" ? "default" : "secondary"}>
          {t(admin.role === "super_user" ? "platform.roleSuperUser" : "platform.roleAdmin")}
        </Badge>
      ),
    },
    ...PLATFORM_PERMISSION_CONFIG.map((cap): WorkBatchTableColumn<PlatformUserProfile> => ({
      id: cap.key,
      label: t(cap.labelKey),
      headerClassName: "text-center",
      cellClassName: "text-center",
      render: (admin) => {
        const granted = admin.role === "super_user" || Boolean(admin.permissions?.[cap.key]);
        return (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-pressed={granted}
            disabled={
              !isSuperUser || admin.role === "super_user" || admin.id === currentUser?.id || busy
            }
            onClick={() => handleToggle(admin, cap.key)}
            aria-label={`${admin.name}: ${t(cap.labelKey)}`}
            className={cn(
              "rounded-lg",
              granted ? "bg-primary/10 text-primary" : "bg-muted/50 text-muted-foreground",
            )}
          >
            {granted ? <Check aria-hidden /> : <X aria-hidden />}
          </Button>
        );
      },
    })),
  ];

  const stepUpErrorMessage =
    stepUpError === "platform.validationConfirmPlatformPassword" ||
    stepUpError === "platform.loadFailed"
      ? t(stepUpError)
      : stepUpError;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <SearchBar
          value={search}
          onChange={setSearch}
          placeholder={t("common.search")}
          className="max-w-sm flex-1"
        />
        <span className="text-xs text-muted-foreground">
          {isSuperUser ? t("platform.roleSuperUser") : t("platform.adminLimitedDescription")}
        </span>
      </div>

      <WorkBatchTable
        data={filteredAdmins}
        columns={columns}
        caption={t("platform.adminPermissionsLabel")}
        emptyState={<EmptyState title={t("platform.noMatchingAdmins")} compact />}
      />

      <FormModal
        open={Boolean(pendingToggle)}
        onClose={cancelStepUp}
        title={t("platform.editAdminAccessTitle")}
        subtitle={
          pendingToggle ? `${pendingToggle.admin.name} · ${pendingToggle.admin.email}` : undefined
        }
        icon={Shield}
        size="sm"
        error={stepUpErrorMessage ?? undefined}
        cancelLabel={t("common.cancel")}
        saveLabel={t("platform.editAdminAccessSave")}
        onSave={() => {
          void confirmStepUp();
        }}
        saving={busy}
        formId="platform-permission-step-up-form"
      >
        <form
          id="platform-permission-step-up-form"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            void confirmStepUp();
          }}
        >
          <Field id="matrix-step-up" label={t("platform.confirmPlatformPassword")} required>
            <Input
              id="matrix-step-up"
              name="platformPassword"
              type="password"
              autoComplete="current-password"
              placeholder={t("platform.confirmPlatformPasswordHint")}
              value={stepUpPassword}
              onChange={(e) => setStepUpPassword(e.target.value)}
              className="h-11 text-sm"
              disabled={busy}
            />
          </Field>
        </form>
      </FormModal>
    </div>
  );
}
