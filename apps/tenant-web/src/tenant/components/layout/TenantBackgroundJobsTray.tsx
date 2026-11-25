import React from "react";
import { useBackgroundJobs } from "@/tenant/hooks/useBackgroundJobs";
import { downloadBackgroundJobArtifact } from "@mms/fe-core/backgroundJobs/api";
import { BackgroundJobsTray } from "@mms/fe-core/components/BackgroundJobsTray";

export interface TenantBackgroundJobsTrayProps {
  className?: string;
}

/**
 * Tenant adapter connecting useBackgroundJobs and downloadBackgroundJobArtifact
 * to the domain-neutral BackgroundJobsTray presentation component.
 */
export function TenantBackgroundJobsTray({
  className,
}: TenantBackgroundJobsTrayProps): React.JSX.Element | null {
  const { jobs, activeJobs, dismiss, clearFinished, refresh } = useBackgroundJobs();

  return (
    <BackgroundJobsTray
      className={className}
      jobs={jobs}
      activeJobs={activeJobs}
      onDismiss={dismiss}
      onClearFinished={clearFinished}
      onRefresh={refresh}
      onDownload={downloadBackgroundJobArtifact}
    />
  );
}

export default TenantBackgroundJobsTray;
