import React from "react";
import { useBackgroundJobs } from "@/tenant/hooks/useBackgroundJobs";
import { downloadBackgroundJobArtifact } from "@/lib/backgroundJobs/backgroundJobApi";
import { BackgroundJobsTray } from "@/components/app/BackgroundJobsTray";

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
