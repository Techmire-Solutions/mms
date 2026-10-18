import { DEFAULT_CURRENCIES, normalizeSessionStatus, todayISO } from "@mms/shared";
import type { Session } from "@/lib/data/sessionsData";

export const SESSION_CURRENCIES = DEFAULT_CURRENCIES.map((currency) => currency.code);

export type SessionFormDraft = Omit<Partial<Session>, "baseFee"> & {
  baseFee: string;
};

export function buildEmptySessionDraft(defaultCurrency: string): SessionFormDraft {
  return {
    name: "",
    categoryId: "",
    programId: "",
    status: "draft",
    startDate: todayISO(),
    endDate: "",
    baseFee: "",
    currency: defaultCurrency,
    description: "",
    faculty: [],
    classes: [],
  };
}

export function buildSessionDraftFromRecord(
  session: Session | null | undefined,
  defaultCurrency: string,
): SessionFormDraft {
  return {
    name: session?.name ?? "",
    categoryId: session?.categoryId ?? "",
    programId: session?.programId ?? "",
    status: session?.status ? normalizeSessionStatus(session.status) : "draft",
    startDate: session?.startDate ?? todayISO(),
    endDate: session?.endDate ?? "",
    workingDays: session?.workingDays ?? [],
    baseFee: session?.baseFee == null ? "" : String(session.baseFee),
    currency: session?.currency ?? defaultCurrency,
    description: session?.description ?? "",
    faculty: session?.faculty ?? [],
    classes: session?.classes ?? [],
  };
}

/** Stable snapshot for FormModal dirty detection (editable fields only). */
export function sessionFormDraftSnapshot(draft: SessionFormDraft): string {
  return JSON.stringify({
    name: draft.name ?? "",
    categoryId: draft.categoryId ?? "",
    programId: draft.programId ?? "",
    status: draft.status ?? "",
    startDate: draft.startDate ?? "",
    endDate: draft.endDate ?? "",
    workingDays: draft.workingDays ?? [],
    baseFee: draft.baseFee ?? "",
    currency: draft.currency ?? "",
    description: draft.description ?? "",
  });
}
