import type { JournalEntry, JournalLine } from "@/lib/data/accountingData";

export interface DraftLine extends Omit<JournalLine, "debit" | "credit"> {
  debit: string | number;
  credit: string | number;
}

export interface DraftForm extends Omit<JournalEntry, "lines"> {
  lines: DraftLine[];
}
