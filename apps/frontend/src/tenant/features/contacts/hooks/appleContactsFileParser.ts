import {
  CONTACTS_IMPORT_MAX_CONTACTS,
  CONTACTS_IMPORT_MAX_FILE_BYTES,
  type Contact,
  parseContactsCsv,
  parseVCard,
} from "@mms/shared";

export interface ParseAppleContactsOptions {
  mobileLabel: string;
  personalLabel: string;
  defaultPhoneCountryCode: string;
}

/** Ingestion cap hit before/after parsing — the caller localizes the message. */
export type AppleContactsParseLimit =
  | { kind: "file_too_large"; limitMb: number }
  | { kind: "too_many_contacts"; count: number; limit: number };

export interface ParseAppleContactsResult {
  parsed: Contact[];
  error?: string;
  limit?: AppleContactsParseLimit;
}

/**
 * Reads a `.vcf`/`.csv` file and parses it on the main thread.
 *
 * Both caps are checked here so an obviously un-importable file never reaches the
 * full-text read + synchronous parse (which would freeze the tab): size before the
 * FileReader, contact count immediately after parsing (the preview list is state).
 */
export function readAndParseAppleContactsFile(
  file: File,
  options: ParseAppleContactsOptions,
  onParsed: (result: ParseAppleContactsResult) => void,
): void {
  if (file.size > CONTACTS_IMPORT_MAX_FILE_BYTES) {
    onParsed({
      parsed: [],
      limit: {
        kind: "file_too_large",
        limitMb: Math.round(CONTACTS_IMPORT_MAX_FILE_BYTES / (1024 * 1024)),
      },
    });
    return;
  }

  const reader = new FileReader();
  reader.onload = (readerEvent) => {
    if (readerEvent.target && typeof readerEvent.target.result === "string") {
      const text = readerEvent.target.result;
      const isCsv = file.name.toLowerCase().endsWith(".csv") || file.type === "text/csv";
      let parsed: Contact[] = [];
      let error: string | undefined;

      if (isCsv) {
        const { contacts, errors } = parseContactsCsv(text, {
          defaultPhoneLabel: options.mobileLabel,
          defaultEmailLabel: options.personalLabel,
        });
        parsed = contacts;
        if (contacts.length === 0) {
          error = errors[0];
        }
      } else {
        parsed = parseVCard(text, {
          mobileLabel: options.mobileLabel,
          personalLabel: options.personalLabel,
          defaultPhoneCountryCode: options.defaultPhoneCountryCode,
        });
      }

      if (parsed.length > CONTACTS_IMPORT_MAX_CONTACTS) {
        onParsed({
          parsed: [],
          limit: {
            kind: "too_many_contacts",
            count: parsed.length,
            limit: CONTACTS_IMPORT_MAX_CONTACTS,
          },
        });
        return;
      }

      onParsed({ parsed, error });
      return;
    }
    // Unreadable result: report an empty parse so the caller's busy state clears.
    onParsed({ parsed: [] });
  };
  reader.onerror = () => onParsed({ parsed: [] });
  reader.readAsText(file);
}
