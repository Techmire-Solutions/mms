import type { WhatsappProviderId, WhatsappProviderPreset } from "./whatsappIntegrationTypes.js";

/** Supported WhatsApp providers — exactly one active per tenant at a time. */
export const WHATSAPP_PROVIDER_PRESETS: readonly WhatsappProviderPreset[] = [
  {
    id: "meta",
    labelKey: "whatsapp.providerMeta",
    hintKey: "whatsapp.providerMetaHint",
    requiresBaseUrl: false,
    requiresPhoneNumberId: true,
    senderPlaceholder: "+15551234567",
  },
  {
    id: "twilio",
    labelKey: "whatsapp.providerTwilio",
    hintKey: "whatsapp.providerTwilioHint",
    requiresBaseUrl: false,
    requiresPhoneNumberId: false,
    senderPlaceholder: "whatsapp:+14155238886",
  },
  {
    id: "infobip",
    labelKey: "whatsapp.providerInfobip",
    hintKey: "whatsapp.providerInfobipHint",
    requiresBaseUrl: true,
    requiresPhoneNumberId: false,
    baseUrlPlaceholder: "xxxxx.api.infobip.com",
    senderPlaceholder: "447860099299",
  },
] as const;

const PRESET_BY_ID = new Map<WhatsappProviderId, WhatsappProviderPreset>(
  WHATSAPP_PROVIDER_PRESETS.map((preset) => [preset.id, preset]),
);

export function getWhatsappProviderPreset(id: WhatsappProviderId): WhatsappProviderPreset {
  return PRESET_BY_ID.get(id) ?? PRESET_BY_ID.get("meta")!;
}

export function listWhatsappProviderPresets(): readonly WhatsappProviderPreset[] {
  return WHATSAPP_PROVIDER_PRESETS;
}
