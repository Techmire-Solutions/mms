import { createColumnRegistry, type ModuleColumnRegistryEntry } from "./moduleColumnCore.js";

export interface ObligationCollectionWorkColumnLabels {
  receiptNo: string;
  receivedDate: string;
  sender: string;
  obligationType: string;
  repMujtahid: string;
  amount: string;
  paymentMode: string;
  reference: string;
  currency: string;
  receivedBy: string;
}

/** Builds tenant-default Work column registry for Obligation collections (before per-user overlay). */
export function buildObligationCollectionWorkColumnRegistry(
  labels: ObligationCollectionWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    [
      "receiptNo",
      "receivedDate",
      "sender",
      "obligationType",
      "repMujtahid",
      "amount",
      "paymentMode",
      "reference",
      "currency",
      "receivedBy",
    ],
    labels,
  );
}

export interface AccountingJournalWorkColumnLabels {
  ref: string;
  date: string;
  description: string;
  tags: string;
  debit: string;
  credit: string;
  status: string;
}

/** Builds tenant-default Work column registry for Accounting journal entries. */
export function buildAccountingJournalWorkColumnRegistry(
  labels: AccountingJournalWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["ref", "date", "description", "tags", "debit", "credit", "status"],
    labels,
  );
}

export interface AccountingAccountWorkColumnLabels {
  code: string;
  name: string;
  type: string;
  subtype: string;
  description: string;
  normalBalance: string;
}

/** Builds tenant-default Work column registry for Chart of Accounts. */
export function buildAccountingAccountWorkColumnRegistry(
  labels: AccountingAccountWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["code", "name", "type", "subtype", "description", "normalBalance"],
    labels,
  );
}

export interface HasanatDistributionWorkColumnLabels {
  card: string;
  recipient: string;
  recipientType: string;
  recipientClass: string;
  quantity: string;
  reason: string;
  issuedDate: string;
  issuedBy: string;
  status: string;
}

/** Builds tenant-default Work column registry for Hasanat distributions. */
export function buildHasanatDistributionWorkColumnRegistry(
  labels: HasanatDistributionWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    [
      "card",
      "recipient",
      "recipientType",
      "recipientClass",
      "quantity",
      "reason",
      "issuedDate",
      "issuedBy",
      "status",
    ],
    labels,
  );
}

export interface HasanatRedemptionWorkColumnLabels {
  student: string;
  reward: string;
  pointsUsed: string;
  date: string;
  approvedBy: string;
}

/** Builds tenant-default Work column registry for Hasanat redemptions. */
export function buildHasanatRedemptionWorkColumnRegistry(
  labels: HasanatRedemptionWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(["student", "reward", "pointsUsed", "date", "approvedBy"], labels);
}
