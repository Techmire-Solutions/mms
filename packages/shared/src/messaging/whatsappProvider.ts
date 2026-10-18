/**
 * Canonical WhatsApp number resolver for MMS.
 * Client dispatch uses the returned id with `wa.me/{id}`; server Puppeteer
 * integrations must call the same helper so eligibility stays consistent.
 */
export class PuppeteerWhatsAppProvider {
  /**
   * Resolves a dialable WhatsApp number id (digits only, country code included).
   * Returns null when the phone cannot be used for WhatsApp open/chat.
   */
  static getNumberId(phone: string | null | undefined): string | null {
    const raw = String(phone ?? "").trim();
    if (!raw) return null;

    let digits = raw.replace(/\D/g, "");
    if (raw.startsWith("+") && digits.length >= 8) {
      // already international
    } else if (digits.startsWith("00") && digits.length >= 10) {
      digits = digits.slice(2);
    } else if (digits.length === 10) {
      // common local mobile without country — leave as-is; callers should prefer E.164
    }

    if (digits.length < 8 || digits.length > 15) return null;
    return digits;
  }
}
