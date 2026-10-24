import type { EmailProviderId, EmailProviderPreset } from "./emailIntegrationTypes.js";

/** Popular mailbox providers with preset SMTP settings (App Password / OAuth-ready). */
export const EMAIL_PROVIDER_PRESETS: readonly EmailProviderPreset[] = [
  {
    id: "gmail",
    labelKey: "email.providerGmail",
    hintKey: "email.providerGmailHint",
    connectionType: "smtp",
    smtp: { host: "smtp.gmail.com", port: 587, secure: false },
    exampleDomain: "gmail.com",
  },
  {
    id: "microsoft365",
    labelKey: "email.providerMicrosoft365",
    hintKey: "email.providerMicrosoft365Hint",
    connectionType: "smtp",
    smtp: { host: "smtp.office365.com", port: 587, secure: false },
    exampleDomain: "yourorg.onmicrosoft.com",
  },
  {
    id: "outlook",
    labelKey: "email.providerOutlook",
    hintKey: "email.providerOutlookHint",
    connectionType: "smtp",
    smtp: { host: "smtp-mail.outlook.com", port: 587, secure: false },
    exampleDomain: "outlook.com",
  },
  {
    id: "yahoo",
    labelKey: "email.providerYahoo",
    hintKey: "email.providerYahooHint",
    connectionType: "smtp",
    smtp: { host: "smtp.mail.yahoo.com", port: 587, secure: false },
    exampleDomain: "yahoo.com",
  },
  {
    id: "icloud",
    labelKey: "email.providerIcloud",
    hintKey: "email.providerIcloudHint",
    connectionType: "smtp",
    smtp: { host: "smtp.mail.me.com", port: 587, secure: false },
    exampleDomain: "icloud.com",
  },
  {
    id: "zoho",
    labelKey: "email.providerZoho",
    hintKey: "email.providerZohoHint",
    connectionType: "smtp",
    smtp: { host: "smtp.zoho.com", port: 587, secure: false },
    exampleDomain: "zoho.com",
  },
  {
    id: "custom_smtp",
    labelKey: "email.providerCustom",
    hintKey: "email.providerCustomHint",
    connectionType: "smtp",
    smtp: { host: "", port: 587, secure: false },
    exampleDomain: "yourdomain.com",
  },
] as const;

const PRESET_BY_ID = new Map<EmailProviderId, EmailProviderPreset>(
  EMAIL_PROVIDER_PRESETS.map((preset) => [preset.id, preset]),
);

/**
 * Returns the SMTP preset for a provider id.
 */
export function getEmailProviderPreset(id: EmailProviderId): EmailProviderPreset {
  return PRESET_BY_ID.get(id) ?? PRESET_BY_ID.get("gmail")!;
}

/**
 * All provider options for settings UI.
 */
export function listEmailProviderPresets(): readonly EmailProviderPreset[] {
  return EMAIL_PROVIDER_PRESETS;
}
