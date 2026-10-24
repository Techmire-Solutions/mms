import { PuppeteerWhatsAppProvider } from "./whatsappProvider.js";

/** Recipient object interface for message personalization */
export interface PersonalizeRecipient {
  id?: string | number;
  name?: string;
  phone?: string;
  email?: string;
  dueDate?: string;
  amount?: string | number;
  madrasaName?: string;
  salutation?: string;
  time?: string;
  studentName?: string;
  rollNumber?: string;
  className?: string;
  grade?: string;
  attendanceStatus?: string;
}

/** Allowlisted personalization token keys (lowercase, without braces). */
export const ALLOWED_PERSONALIZATION_TOKEN_KEYS = new Set([
  "name",
  "first_name",
  "phone",
  "email",
  "date",
  "due_date",
  "amount",
  "madrasa_name",
  "school_name",
  "salutation",
  "time",
  "student_name",
  "roll_number",
  "class",
  "grade",
  "attendance_status",
]);

const PERSONALIZATION_TOKEN_PATTERN_SOURCE = String.raw`\{([a-z_]+)(?:\|([^}]+))?\}`;

function personalizationTokenPattern(): RegExp {
  return new RegExp(PERSONALIZATION_TOKEN_PATTERN_SOURCE, "gi");
}

/**
 * Returns unknown personalization token keys found in body text (deduped, lowercase).
 * Unknown tokens must be rejected before send/save — `mms-messaging`.
 */
export function findUnknownPersonalizationTokens(body: string): string[] {
  if (!body) return [];
  const unknown = new Set<string>();
  for (const match of body.matchAll(personalizationTokenPattern())) {
    const key = String(match[1] ?? "").toLowerCase();
    if (key && !ALLOWED_PERSONALIZATION_TOKEN_KEYS.has(key)) {
      unknown.add(key);
    }
  }
  return [...unknown];
}

/**
 * Centralized message personalization logic.
 * Replaces placeholders like {name}, {first_name}, {phone}, {email}, {date}, {due_date}, {amount}, {madrasa_name}, {salutation}, {time} with recipient details.
 * Unknown tokens are left as literals — callers must reject via `findUnknownPersonalizationTokens` before send/save.
 * @param body Template body text containing placeholders
 * @param recipient Target recipient object with name, phone, email, etc.
 * @param options Optional overrides (e.g., date, dueDate, amount, madrasaName)
 * @returns Interpolated message text
 */
export function personalizeMessage(
  body: string,
  recipient: PersonalizeRecipient,
  options?: {
    date?: string;
    dueDate?: string;
    amount?: string | number;
    madrasaName?: string;
    salutation?: string;
  },
): string {
  if (!body) return "";
  const name = recipient.name || "";
  const firstName = name.trim().split(/\s+/)[0] || "";
  const phone = recipient.phone || "";
  const email = recipient.email || "";
  const dateStr = options?.date || new Date().toISOString().split("T")[0];
  const dueDateStr = recipient.dueDate || options?.dueDate || "";
  const amountStr =
    recipient.amount !== undefined
      ? String(recipient.amount)
      : options?.amount !== undefined
        ? String(options.amount)
        : "";
  const madrasaNameStr = recipient.madrasaName || options?.madrasaName || "";
  const salutationStr = recipient.salutation || options?.salutation || "";
  const timeStr = recipient.time || "";
  const studentNameStr = recipient.studentName || "";
  const rollNumberStr = recipient.rollNumber || "";
  const classStr = recipient.className || "";
  const gradeStr = recipient.grade || "";
  const attendanceStatusStr = recipient.attendanceStatus || "";

  const tokenValues: Record<string, string> = {
    name,
    first_name: firstName,
    phone,
    email,
    date: dateStr,
    due_date: dueDateStr,
    amount: amountStr,
    madrasa_name: madrasaNameStr,
    school_name: madrasaNameStr,
    salutation: salutationStr,
    time: timeStr,
    student_name: studentNameStr,
    roll_number: rollNumberStr,
    class: classStr,
    grade: gradeStr,
    attendance_status: attendanceStatusStr,
  };

  return body.replace(personalizationTokenPattern(), (match, key, fallback) => {
    const lowerKey = String(key).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(tokenValues, lowerKey)) {
      return match;
    }
    const val = tokenValues[lowerKey];
    if (val !== undefined && val !== "") {
      return val;
    }
    return fallback !== undefined ? fallback : "";
  });
}

/** Interface defining a dynamic personalization variable token for messaging templates. */
export interface VariableToken {
  token: string;
  labelKey: string;
  fallbackExample: string;
}

/** Registry of standard dynamic personalization tokens supported across SMS, WhatsApp, and Email campaigns. */
export const MESSAGING_VARIABLE_TOKENS: VariableToken[] = [
  { token: "{name}", labelKey: "messaging.tokenFullName", fallbackExample: "{name|Valued Parent}" },
  {
    token: "{first_name}",
    labelKey: "messaging.tokenFirstName",
    fallbackExample: "{first_name|Parent}",
  },
  { token: "{phone}", labelKey: "messaging.tokenPhone", fallbackExample: "{phone}" },
  { token: "{email}", labelKey: "messaging.tokenEmail", fallbackExample: "{email}" },
  { token: "{date}", labelKey: "messaging.tokenDate", fallbackExample: "{date}" },
  { token: "{due_date}", labelKey: "messaging.tokenDueDate", fallbackExample: "{due_date}" },
  { token: "{amount}", labelKey: "messaging.tokenAmount", fallbackExample: "{amount|0 PKR}" },
  {
    token: "{madrasa_name}",
    labelKey: "messaging.tokenMadrasaName",
    fallbackExample: "{madrasa_name|Madrasa}",
  },
  {
    token: "{salutation}",
    labelKey: "messaging.tokenSalutation",
    fallbackExample: "{salutation|Respected}",
  },
  { token: "{time}", labelKey: "messaging.tokenTime", fallbackExample: "{time}" },
  {
    token: "{student_name}",
    labelKey: "messaging.tokenStudentName",
    fallbackExample: "{student_name|Student}",
  },
  {
    token: "{roll_number}",
    labelKey: "messaging.tokenRollNumber",
    fallbackExample: "{roll_number}",
  },
  { token: "{class}", labelKey: "messaging.tokenClass", fallbackExample: "{class}" },
  { token: "{grade}", labelKey: "messaging.tokenGrade", fallbackExample: "{grade}" },
  {
    token: "{attendance_status}",
    labelKey: "messaging.tokenAttendanceStatus",
    fallbackExample: "{attendance_status|present}",
  },
];

/**
 * Appends or inserts a variable token tag into a message body string.
 * @param body Current message body string
 * @param token Variable token tag to append (e.g., '{name}')
 * @returns Updated message body string
 */
export function appendVariableToken(body: string, token: string): string {
  return body ? `${body} ${token}` : token;
}

/**
 * Inserts a variable token at a textarea selection range (caret-aware).
 * @returns next body and caret index after the inserted token
 */
export function insertVariableTokenAt(
  body: string,
  token: string,
  selectionStart: number,
  selectionEnd: number = selectionStart,
): { next: string; caret: number } {
  const start = Math.max(0, Math.min(selectionStart, body.length));
  const end = Math.max(start, Math.min(selectionEnd, body.length));
  const before = body.slice(0, start);
  const after = body.slice(end);
  const needsSpace = before.length > 0 && !/\s$/.test(before);
  const insert = `${needsSpace ? " " : ""}${token}`;
  return { next: `${before}${insert}${after}`, caret: before.length + insert.length };
}

/**
 * Validates whether a recipient has a valid contact address for the chosen dispatch channel.
 */
export function validateRecipientAddress(
  recipient: PersonalizeRecipient,
  channel: "sms" | "whatsapp" | "email",
): {
  isValid: boolean;
  address: string;
  reason?: "missing_email" | "invalid_email_format" | "missing_phone" | "invalid_phone_format";
} {
  if (channel === "email") {
    const email = recipient.email?.trim() || "";
    if (!email) return { isValid: false, address: "", reason: "missing_email" };
    const isValidFormat = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    return {
      isValid: isValidFormat,
      address: email,
      reason: isValidFormat ? undefined : "invalid_email_format",
    };
  }

  const phone = recipient.phone?.trim() || "";
  if (!phone) return { isValid: false, address: "", reason: "missing_phone" };

  if (channel === "whatsapp") {
    const numberId = PuppeteerWhatsAppProvider.getNumberId(phone);
    return {
      isValid: numberId != null,
      address: numberId ?? phone,
      reason: numberId != null ? undefined : "invalid_phone_format",
    };
  }

  const cleanDigits = phone.replace(/\D/g, "");
  const isValidLength = cleanDigits.length >= 7 && cleanDigits.length <= 15;
  return {
    isValid: isValidLength,
    address: phone,
    reason: isValidLength ? undefined : "invalid_phone_format",
  };
}
