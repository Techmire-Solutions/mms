import { listFiscalYearsByWorkspace } from "./accountingFiscalYearsRepository.js";
import { accountExists } from "./accountingHyperinflationRepository.js";
import { findAccountsByIds } from "./accountingAccountsRepository.js";
import {
  findHedgeRelationship,
  insertHedgeRelationship,
  insertHedgeValuation,
  listHedgeRelationships,
  listHedgeRelationshipsPage,
  updateHedgeStatus,
} from "./accountingHedgesRepository.js";

/** Drizzle-backed storage for IFRS 9 hedge relationships (ports & adapters seam). */
export const accountingHedgesRepository = {
  listFiscalYearsByWorkspace,
  accountExists,
  findAccountsByIds,
  listHedgeRelationships,
  listHedgeRelationshipsPage,
  findHedgeRelationship,
  insertHedgeRelationship,
  insertHedgeValuation,
  updateHedgeStatus,
};

export type AccountingHedgesStore = typeof accountingHedgesRepository;
