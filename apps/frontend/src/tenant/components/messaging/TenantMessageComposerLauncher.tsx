import React, { Suspense } from "react";
import type { MessagingTarget } from "@/hooks/useMessageComposerState";

const TenantMessageComposer = React.lazy(
  () => import("@/tenant/components/messaging/TenantMessageComposer"),
);

export interface TenantMessageComposerLauncherProps {
  messagingTarget: MessagingTarget | null;
  onClose: () => void;
  fallback?: React.ReactNode;
}

/**
 * Standardized lazy-loaded launcher for TenantMessageComposer with Suspense built-in.
 * Deduplicates lazy imports across dashboard widgets, tabs, and module overlays.
 */
export function TenantMessageComposerLauncher({
  messagingTarget,
  onClose,
  fallback = null,
}: TenantMessageComposerLauncherProps): React.JSX.Element | null {
  if (!messagingTarget) return null;
  return (
    <Suspense fallback={fallback}>
      <TenantMessageComposer
        channel={messagingTarget.channel}
        recipients={messagingTarget.recipients}
        onClose={onClose}
      />
    </Suspense>
  );
}

export default TenantMessageComposerLauncher;
