import { useState, type Dispatch, type SetStateAction } from "react";
import { generateClientEntityId, type JournalTemplate } from "@mms/shared";
import type { DraftForm, DraftLine } from "../lib/journalEntryFormTypes";

export type JournalAmountSide = "debit" | "credit";

interface TemplateLock {
  templateName: string;
  sides: Record<string, JournalAmountSide>;
}

const blankLine = (): DraftLine => ({
  id: generateClientEntityId("l", "-"),
  account_id: "",
  debit: "",
  credit: "",
  description: "",
});

/** First non-empty amount on the voucher, so applying a template keeps what was typed. */
function carriedAmount(lines: readonly DraftLine[]): string | number {
  for (const line of lines) {
    if (line.debit !== "" && line.debit !== 0) return line.debit;
    if (line.credit !== "" && line.credit !== 0) return line.credit;
  }
  return "";
}

/**
 * Puts the template's heads on the first two lines (debit then credit), carrying
 * the amount over; later lines are left as they are.
 */
export function applyTemplateToLines(
  lines: readonly DraftLine[],
  template: JournalTemplate,
): DraftLine[] {
  const amount = carriedAmount(lines);
  const [first = blankLine(), second = blankLine(), ...rest] = lines;
  return [
    {
      ...first,
      account_id: template.debitAccountId || first.account_id,
      debit: amount,
      credit: "",
    },
    {
      ...second,
      account_id: template.creditAccountId || second.account_id,
      debit: "",
      credit: amount,
    },
    ...rest,
  ];
}

interface UseJournalLineAssistOptions {
  form: DraftForm;
  setForm: Dispatch<SetStateAction<DraftForm>>;
  updateLine: (lineIndex: number, field: keyof DraftLine, fieldValue: string | number) => void;
  toggleTag: (tag: string) => void;
  templates: readonly JournalTemplate[];
}

/**
 * JV entry helpers layered over `useJournalEntryForm`: picking a template tag
 * fills its heads and locks each templated line to its side, and with exactly
 * two lines an amount typed on one side can be mirrored onto the other line.
 */
export function useJournalLineAssist({
  form,
  setForm,
  updateLine,
  toggleTag,
  templates,
}: UseJournalLineAssistOptions) {
  const [lock, setLock] = useState<TemplateLock | null>(null);
  const [mirrorAmounts, setMirrorAmounts] = useState(true);
  const canMirror = form.lines.length === 2;

  const toggleTemplateTag = (tag: string) => {
    const wasActive = (form.tags ?? []).includes(tag);
    toggleTag(tag);
    if (wasActive) {
      if (lock?.templateName === tag) setLock(null);
      return;
    }
    const template = templates.find((candidate) => candidate.name === tag);
    if (!template || (!template.debitAccountId && !template.creditAccountId)) return;
    const nextLines = applyTemplateToLines(form.lines, template);
    setForm((prev) => ({ ...prev, lines: nextLines }));
    setLock({
      templateName: tag,
      sides: { [nextLines[0].id]: "debit", [nextLines[1].id]: "credit" },
    });
  };

  const updateLineAssisted = (
    lineIndex: number,
    field: keyof DraftLine,
    fieldValue: string | number,
  ) => {
    updateLine(lineIndex, field, fieldValue);
    if (!mirrorAmounts || !canMirror || (field !== "debit" && field !== "credit")) return;
    updateLine(lineIndex === 0 ? 1 : 0, field === "debit" ? "credit" : "debit", fieldValue);
  };

  const lockedSideFor = (lineId: string): JournalAmountSide | undefined => lock?.sides[lineId];

  return {
    toggleTemplateTag,
    updateLineAssisted,
    lockedSideFor,
    lockTemplateName: lock?.templateName ?? null,
    canMirror,
    mirrorAmounts,
    setMirrorAmounts,
  };
}
