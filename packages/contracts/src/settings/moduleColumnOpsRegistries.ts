import {
  createColumnRegistry,
  type ModuleColumnKind,
  type ModuleColumnRegistryEntry,
} from "./moduleColumnCore.js";

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

const OBLIGATION_COLLECTION_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  receiptNo: "reference",
  receivedDate: "date",
  sender: "person",
  obligationType: "shortText",
  repMujtahid: "person",
  amount: "money",
  paymentMode: "status",
  reference: "reference",
  currency: "code",
  receivedBy: "person",
};

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
    true,
    OBLIGATION_COLLECTION_COLUMN_KINDS,
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

const ACCOUNTING_JOURNAL_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  ref: "reference",
  date: "date",
  description: "longText",
  tags: "chips",
  debit: "money",
  credit: "money",
  status: "status",
};

/** Builds tenant-default Work column registry for Accounting journal entries. */
export function buildAccountingJournalWorkColumnRegistry(
  labels: AccountingJournalWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["ref", "date", "description", "tags", "debit", "credit", "status"],
    labels,
    true,
    ACCOUNTING_JOURNAL_COLUMN_KINDS,
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

const ACCOUNTING_ACCOUNT_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  code: "code",
  name: "title",
  type: "status",
  subtype: "shortText",
  description: "longText",
  normalBalance: "status",
};

/** Builds tenant-default Work column registry for Chart of Accounts. */
export function buildAccountingAccountWorkColumnRegistry(
  labels: AccountingAccountWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["code", "name", "type", "subtype", "description", "normalBalance"],
    labels,
    true,
    ACCOUNTING_ACCOUNT_COLUMN_KINDS,
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

const HASANAT_DISTRIBUTION_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  card: "reference",
  recipient: "person",
  recipientType: "status",
  recipientClass: "shortText",
  quantity: "number",
  reason: "longText",
  issuedDate: "date",
  issuedBy: "person",
  status: "status",
};

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
    true,
    HASANAT_DISTRIBUTION_COLUMN_KINDS,
  );
}

export interface HasanatRedemptionWorkColumnLabels {
  student: string;
  reward: string;
  pointsUsed: string;
  date: string;
  approvedBy: string;
}

const HASANAT_REDEMPTION_COLUMN_KINDS: Readonly<Record<string, ModuleColumnKind>> = {
  student: "person",
  reward: "shortText",
  pointsUsed: "number",
  date: "date",
  approvedBy: "person",
};

/** Builds tenant-default Work column registry for Hasanat redemptions. */
export function buildHasanatRedemptionWorkColumnRegistry(
  labels: HasanatRedemptionWorkColumnLabels,
): ModuleColumnRegistryEntry[] {
  return createColumnRegistry(
    ["student", "reward", "pointsUsed", "date", "approvedBy"],
    labels,
    true,
    HASANAT_REDEMPTION_COLUMN_KINDS,
  );
}
