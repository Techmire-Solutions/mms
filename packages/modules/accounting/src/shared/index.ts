/**
 * Accounting shared audience.
 *
 * Contracts remain the DTO/Zod SSOT; this entry point exposes the accounting
 * subset plus module-local pure policy. It must stay free of Node, React,
 * Fastify, Drizzle and app imports.
 */
export * from "@mms/contracts";

export interface AccountingPeriodWindow {
  fiscalYearId: string;
  startDate: string;
  endDate: string;
  status: "open" | "closed";
}

export type JournalTransition = "draft" | "posted" | "reversed";

/** Pure journal state transition guard shared by backend and frontend. */
export function canTransitionJournal(from: JournalTransition, to: JournalTransition): boolean {
  if (from === to) return false;
  return (from === "draft" && to === "posted") || (from === "posted" && to === "reversed");
}

/** A closed fiscal year or posting period blocks posting; reopening is explicit. */
export function isPostingWindowOpen(input: {
  fiscalYearStatus: string;
  periodStatus?: string | null;
}): boolean {
  if (input.fiscalYearStatus !== "open") return false;
  return !input.periodStatus || input.periodStatus === "open";
}

export function assertPostingWindowOpen(input: {
  fiscalYearStatus: string;
  periodStatus?: string | null;
}): void {
  if (!isPostingWindowOpen(input)) {
    throw new Error("Accounting period is closed for posting");
  }
}
