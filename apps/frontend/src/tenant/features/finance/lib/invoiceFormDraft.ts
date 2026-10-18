import {
  todayISO,
  formatInvoiceNumber,
  type FinanceSettings,
  type FeeStructure,
  type InvoiceCreateInput,
} from "@mms/shared";

export interface InvoiceDraft {
  studentId: string;
  studentName: string;
  class: string;
  session: string;
  baseFee: string;
  discountType: string;
  discountValue: string;
  dueDate: string;
  feeStructureId: string;
}

export function nextInvoiceId(
  prefixOrSettings: string | Partial<FinanceSettings>,
  currentSeq = 1,
): string {
  const currentYear = new Date().getFullYear();
  return formatInvoiceNumber(currentYear, currentSeq, prefixOrSettings);
}

export function createInitialDraft(dueDays: string): InvoiceDraft {
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + Math.max(0, Number.parseInt(dueDays, 10) || 0));
  return {
    studentId: "",
    studentName: "",
    class: "",
    session: "",
    baseFee: "",
    discountType: "",
    discountValue: "0",
    dueDate: dueDate.toISOString().slice(0, 10) || todayISO(),
    feeStructureId: "",
  };
}

export function computeInvoiceAmounts(baseFeeRaw: string, discountValueRaw: string) {
  const baseFee = Number(baseFeeRaw || 0);
  const discountValue = Number(discountValueRaw || 0);
  const discountAmt = Math.min(Math.max(discountValue, 0), Math.max(baseFee, 0));
  const finalAmt = Math.max(baseFee - discountAmt, 0);
  return { baseFee, discountValue, discountAmt, finalAmt };
}

export function canSaveInvoiceDraft(draft: InvoiceDraft, baseFee: number): boolean {
  return (
    draft.studentId.trim().length > 0 &&
    draft.studentName.trim().length > 0 &&
    draft.class.trim().length > 0 &&
    draft.session.trim().length > 0 &&
    draft.dueDate.trim().length > 0 &&
    baseFee > 0
  );
}

export function buildInvoiceCreatePayload(
  draft: InvoiceDraft,
  baseFee: number,
  discountValue: number,
  discountAmt: number,
  finalAmt: number,
  invoiceId: string,
  feeStructures: FeeStructure[],
): InvoiceCreateInput {
  const structure = feeStructures.find((item) => item.id === draft.feeStructureId);
  const lines =
    !structure || structure.items.length === 0
      ? undefined
      : structure.items.map((item, index) => ({
          id: `il-${index + 1}`,
          feeItemId: item.id,
          description: item.name,
          quantity: 1,
          amount: item.amount,
          discountAmt: 0,
        }));

  return {
    id: invoiceId,
    studentId: draft.studentId.trim(),
    studentName: draft.studentName.trim(),
    class: draft.class.trim(),
    session: draft.session.trim(),
    baseFee,
    discountType: draft.discountType.trim() || null,
    discountValue,
    discountAmt,
    finalAmt,
    status: "pending",
    dueDate: draft.dueDate,
    paidDate: null,
    method: null,
    paidAmt: 0,
    feeStructureId: draft.feeStructureId || null,
    lines,
  };
}
