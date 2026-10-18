export function readEnv(name: string): string {
  return process.env[name]?.trim() ?? "";
}

export function isPlatformSmtpTransportConfigured(): boolean {
  const host = readEnv("PLATFORM_SMTP_HOST");
  const user = readEnv("PLATFORM_SMTP_USER");
  const pass = readEnv("PLATFORM_SMTP_PASS");
  const from = readEnv("PLATFORM_EMAIL_FROM");
  return Boolean(host && user && pass && from);
}

export function isPlatformResendConfigured(): boolean {
  return Boolean(readEnv("PLATFORM_RESEND_API_KEY") && readEnv("PLATFORM_EMAIL_FROM"));
}

/** True when platform email can be sent (Resend API or SMTP + from address). */
export function isPlatformSmtpConfigured(): boolean {
  return isPlatformResendConfigured() || isPlatformSmtpTransportConfigured();
}

export function platformFromHeader(): string {
  const fromAddress = readEnv("PLATFORM_EMAIL_FROM");
  const fromName = readEnv("PLATFORM_EMAIL_FROM_NAME") || "MMS Platform";
  return `"${fromName}" <${fromAddress}>`;
}

/** Public apex URL for links in platform emails (reset password, etc.). */
export function resolvePlatformAppOrigin(): string {
  const configured = readEnv("PLATFORM_APP_URL") || readEnv("VITE_APP_URL");
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") {
    throw new Error("PLATFORM_APP_URL is required in production for platform email links");
  }
  return "http://localhost:5173";
}
