import React, { Suspense } from "react";
import { useIsTenantHost } from "@/lib/host/useIsTenantHost";
import RouteStatusFallback from "@/components/routing/RouteStatusFallback";

const TenantRoutes = React.lazy(() => import("@/tenant/routes/TenantRoutes"));
const ApexRoutesWithSuspense = React.lazy(() =>
  import("@/platform/routes/ApexRoutes").then((m) => ({ default: m.ApexRoutesWithSuspense })),
);

/**
 * Host switch — renders exactly one of platform apex or tenant madrasa trees.
 */
export default function HostRoutes(): React.JSX.Element {
  const isTenantHost = useIsTenantHost();

  return (
    <Suspense fallback={<RouteStatusFallback fullScreen />}>
      {isTenantHost ? <TenantRoutes /> : <ApexRoutesWithSuspense />}
    </Suspense>
  );
}
