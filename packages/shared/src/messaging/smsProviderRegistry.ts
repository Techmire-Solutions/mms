import type { SmsProviderId, SmsProviderPreset } from "./smsIntegrationTypes.js";

/** Supported SMS providers — exactly one may be active per tenant at a time. */
export const SMS_PROVIDER_PRESETS: readonly SmsProviderPreset[] = [
  {
    id: "logiqueues",
    labelKey: "sms.providerLogiqueues",
    hintKey: "sms.providerLogiqueuesHint",
    requiresBaseUrl: true,
    baseUrlPlaceholder: "https://logiqueues.com/gateway/v1 (blank = default)",
  },
  {
    id: "twilio",
    labelKey: "sms.providerTwilio",
    hintKey: "sms.providerTwilioHint",
    requiresBaseUrl: false,
  },
  {
    id: "vonage",
    labelKey: "sms.providerVonage",
    hintKey: "sms.providerVonageHint",
    requiresBaseUrl: false,
  },
  {
    id: "msg91",
    labelKey: "sms.providerMsg91",
    hintKey: "sms.providerMsg91Hint",
    requiresBaseUrl: false,
  },
  {
    id: "infobip",
    labelKey: "sms.providerInfobip",
    hintKey: "sms.providerInfobipHint",
    requiresBaseUrl: true,
    baseUrlPlaceholder: "xxxxx.api.infobip.com",
  },
  {
    id: "telesign",
    labelKey: "sms.providerTelesign",
    hintKey: "sms.providerTelesignHint",
    requiresBaseUrl: false,
  },
] as const;

const PRESET_BY_ID = new Map<SmsProviderId, SmsProviderPreset>(
  SMS_PROVIDER_PRESETS.map((preset) => [preset.id, preset]),
);

export function getSmsProviderPreset(id: SmsProviderId): SmsProviderPreset {
  return PRESET_BY_ID.get(id) ?? PRESET_BY_ID.get("twilio")!;
}

export function listSmsProviderPresets(): readonly SmsProviderPreset[] {
  return SMS_PROVIDER_PRESETS;
}
