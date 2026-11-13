import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import { accountExists } from "../../db/repositories/accountingHyperinflationRepository.js";
import { findAccountsByIds } from "../../db/repositories/accountingAccountsRepository.js";
import {
  findHedgeRelationship,
  insertHedgeRelationship,
  insertHedgeValuation,
  listHedgeRelationships,
  listHedgeRelationshipsPage,
  updateHedgeStatus,
} from "../../db/repositories/accountingHedgesRepository.js";

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
