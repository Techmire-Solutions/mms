import React from "react";
import { PlatformPermissionMatrix } from "@/platform/components/users/PlatformPermissionMatrix";

/**
 * Users Setup tier — permissions matrix only.
 * Security policies live exclusively under Settings → Security.
 */
export function PlatformUsersSetupTier(): React.JSX.Element {
  return (
    <div className="space-y-6 text-start">
      <PlatformPermissionMatrix />
    </div>
  );
}
