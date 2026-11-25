import React from "react";
import { SettingsPanel } from "@mms/fe-core/components/SettingsShell";
import { PlatformRegionalSecuritySection } from "@/platform/features/settings/components/PlatformRegionalSecuritySection";
import { PlatformNotificationsSettingsPanel } from "@/platform/features/settings/components/PlatformNotificationsSettingsPanel";
import { PlatformGlobalSettingsPanel } from "@/platform/features/settings/components/PlatformGlobalSettingsPanel";

/**
 * General — regional display defaults, enforced security policy, notification
 * channels, and TLS/certbot settings (all previously separate platform tabs).
 */
export default function PlatformGeneralSettingsPanel(): React.JSX.Element {
  return (
    <SettingsPanel width="medium" introKey="platform.settings.introGlobal">
      <div className="space-y-8">
        <PlatformRegionalSecuritySection />
        <PlatformNotificationsSettingsPanel />
        <PlatformGlobalSettingsPanel />
      </div>
    </SettingsPanel>
  );
}
