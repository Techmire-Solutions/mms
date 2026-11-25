import React from "react";
import { usePlatformAdmins } from "@/platform/features/users/hooks/usePlatformAdmins";
import { PlatformAdminsList } from "@/platform/features/users/components/PlatformAdminsList";
import { PlatformIamPanel } from "@/platform/features/users/components/PlatformIamPanel";

/**
 * Users Work tier — operators directory plus the platform IAM surface
 * (cross-tenant search + audited impersonation). Activity logs live exclusively
 * at `/platform/activity-logs`.
 */
export function PlatformUsersWorkTier(): React.JSX.Element {
  const { data: admins, isLoading, isError, refetch } = usePlatformAdmins();

  return (
    <div className="space-y-6 text-start">
      <PlatformAdminsList
        admins={admins}
        loading={isLoading}
        fetchError={isError}
        onRetry={() => void refetch()}
      />
      <PlatformIamPanel />
    </div>
  );
}
