import React from "react";
import {
  GlobalUsersTable,
  TenantImpersonationModal,
  type GlobalUsersTableLabels,
  type TenantImpersonationModalLabels,
} from "@mms/mod-iam/frontend/platform";
import { useTranslation } from "@mms/fe-core/i18n";
import { usePlatformPermissions } from "@/platform/hooks/usePlatformPermissions";

type ImpersonationTarget = { tenant: string; userId: string; name: string } | null;

/**
 * Platform Operator IAM surface: cross-tenant user/organization search plus the
 * password-confirmed, audited impersonation dialog supplied by `@mms/mod-iam`.
 * Reads need the `admins` capability (the page gate); the impersonate action is
 * only offered to `super_user`, matching the backend pre-handler.
 */
export function PlatformIamPanel(): React.JSX.Element {
  const { t } = useTranslation();
  const { isSuperUser } = usePlatformPermissions();
  const [target, setTarget] = React.useState<ImpersonationTarget>(null);

  const tableLabels: GlobalUsersTableLabels = {
    title: t("platform.iam.title"),
    searchPlaceholder: t("platform.iam.searchPlaceholder"),
    users: t("platform.iam.users"),
    organizations: t("platform.iam.organizations"),
    empty: t("platform.iam.empty"),
    loading: t("platform.iam.loading"),
    error: t("platform.iam.error"),
    impersonate: t("platform.iam.impersonate"),
  };

  const modalLabels: TenantImpersonationModalLabels = {
    title: t("platform.iam.impersonationTitle"),
    reason: t("platform.iam.reason"),
    password: t("platform.iam.password"),
    submit: t("platform.iam.submit"),
    cancel: t("platform.iam.cancel"),
    sending: t("platform.iam.sending"),
    error: t("platform.iam.error"),
    success: t("platform.iam.success"),
    expires: t("platform.iam.expires"),
    done: t("platform.iam.done"),
  };

  return (
    <div className="space-y-4">
      <GlobalUsersTable
        labels={tableLabels}
        onImpersonate={isSuperUser ? (input) => setTarget(input) : undefined}
      />
      <TenantImpersonationModal
        labels={modalLabels}
        onClose={() => setTarget(null)}
        open={target !== null}
        target={target}
      />
    </div>
  );
}
