export interface SmsSegmentResult {
  charCount: number;
  isUnicode: boolean;
  segmentLimit: number;
  totalSegments: number;
  remainingInSegment: number;
}

/** Soft cost thresholds used by campaign composers (Twilio ≤320 guidance). */
export const SMS_SOFT_CHAR_WARN = 320;
export const SMS_MULTI_SEGMENT_WARN = 2;
export const SMS_HIGH_SEGMENT_WARN = 3;

/** GSM 7-bit basic character set regex */
const GSM_7BIT_BASIC_REGEX =
  /^[A-Za-z0-9 @£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#%&'()*+,\-./:;<=>?¡¿\r\n\t]*$/;
const GSM_7BIT_EXTENSION = "{}[]~^|€";

function isGsm7Character(ch: string): boolean {
  if (GSM_7BIT_EXTENSION.includes(ch)) return true;
  return GSM_7BIT_BASIC_REGEX.test(ch);
}

/**
 * Returns unique non-GSM-7 characters in text (order of first appearance).
 * Used to hint authors that curly quotes / emojis force UCS-2.
 */
export function listNonGsmCharacters(text: string, limit = 8): string[] {
  if (!text) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ch of text) {
    if (isGsm7Character(ch) || seen.has(ch)) continue;
    seen.add(ch);
    out.push(ch);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Calculates SMS character length, detects Unicode vs GSM 7-bit encoding,
 * and computes total SMS segments according to international telecommunication standards.
 */
export function calculateSmsSegments(text: string): SmsSegmentResult {
  if (!text) {
    return {
      charCount: 0,
      isUnicode: false,
      segmentLimit: 160,
      totalSegments: 1,
      remainingInSegment: 160,
    };
  }

  // A string is GSM 7-bit if all characters without extension chars match the basic set
  const nonExtText = text.replace(/[{}[\]~^|€]/g, "");
  const isUnicode = !GSM_7BIT_BASIC_REGEX.test(nonExtText);

  if (isUnicode) {
    // UTF-16 encoding calculation
    const charCount = Array.from(text).length; // Handles multi-byte Unicode surrogate pairs / emojis
    if (charCount <= 70) {
      return {
        charCount,
        isUnicode: true,
        segmentLimit: 70,
        totalSegments: 1,
        remainingInSegment: 70 - charCount,
      };
    }
    const totalSegments = Math.ceil(charCount / 67);
    const usedInCurrent = charCount % 67 === 0 ? 67 : charCount % 67;
    return {
      charCount,
      isUnicode: true,
      segmentLimit: 67,
      totalSegments,
      remainingInSegment: 67 - usedInCurrent,
    };
  } else {
    // GSM 7-bit encoding calculation (extension characters count as 2)
    let gsmCharLength = 0;
    for (const ch of text) {
      if ("{}[]~^|€".includes(ch)) {
        gsmCharLength += 2;
      } else {
        gsmCharLength += 1;
      }
    }

    if (gsmCharLength <= 160) {
      return {
        charCount: gsmCharLength,
        isUnicode: false,
        segmentLimit: 160,
        totalSegments: 1,
        remainingInSegment: 160 - gsmCharLength,
      };
    }
    const totalSegments = Math.ceil(gsmCharLength / 153);
    const usedInCurrent = gsmCharLength % 153 === 0 ? 153 : gsmCharLength % 153;
    return {
      charCount: gsmCharLength,
      isUnicode: false,
      segmentLimit: 153,
      totalSegments,
      remainingInSegment: 153 - usedInCurrent,
    };
  }
}

/**
 * Builds a `sms:` URI that opens the device Messages app with recipient and body pre-filled.
 * The user must tap Send — the app cannot send SMS silently.
 */
export function buildDeviceSmsUri(phone: string, body = ""): string | null {
  const trimmed = phone.trim();
  if (!trimmed) return null;

  const normalized = trimmed.replace(/[^\d+]/g, "");
  if (normalized.replace(/\D/g, "").length < 8) return null;

  const address = normalized.startsWith("+") ? normalized : normalized;
  if (!body.trim()) return `sms:${address}`;

  return `sms:${address}?body=${encodeURIComponent(body.trim())}`;
}
