import { usePlatformSetupStatus } from "@/platform/features/auth/hooks/usePlatformSetupStatus";

/** Warms apex setup-status query in parallel with platform auth on boot. */
export function ApexBootPrefetch(): null {
  usePlatformSetupStatus();
  return null;
}
