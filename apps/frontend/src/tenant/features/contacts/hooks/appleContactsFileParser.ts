import { type Contact, parseContactsCsv, parseVCard } from "@mms/shared";

export interface ParseAppleContactsOptions {
  mobileLabel: string;
  personalLabel: string;
  defaultPhoneCountryCode: string;
}

export interface ParseAppleContactsResult {
  parsed: Contact[];
  error?: string;
}

export function readAndParseAppleContactsFile(
  file: File,
  options: ParseAppleContactsOptions,
  onParsed: (result: ParseAppleContactsResult) => void,
): void {
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

      onParsed({ parsed, error });
    }
  };
  reader.readAsText(file);
}
