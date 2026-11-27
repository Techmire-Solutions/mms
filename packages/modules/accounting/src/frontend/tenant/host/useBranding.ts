import { getAccountingHost } from "../host.js";
import type { BrandingSettings } from "@mms/contracts";

export function useBranding(): BrandingSettings {
  return getAccountingHost().useBranding();
}
