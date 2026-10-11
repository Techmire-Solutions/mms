import React from "react";
import { useBackgroundJobs } from "@/tenant/hooks/useBackgroundJobs";
import { downloadBackgroundJobArtifact } from "@/lib/backgroundJobs/backgroundJobApi";
import { BackgroundJobsTray } from "@/components/ui/BackgroundJobsTray";

export interface TenantBackgroundJobsTrayProps {
  compact?: boolean;
  className?: string;
}

/**
 * Tenant adapter connecting useBackgroundJobs and downloadBackgroundJobArtifact
 * to the domain-neutral BackgroundJobsTray presentation component.
 */
export function TenantBackgroundJobsTray({
  compact = false,
  className,
}: TenantBackgroundJobsTrayProps): React.JSX.Element | null {
  const { jobs, activeJobs, dismiss, clearFinished, refresh } = useBackgroundJobs();

  return (
    <BackgroundJobsTray
      compact={compact}
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
