import { listFiscalYearsByWorkspace } from "../../db/repositories/accountingFiscalYearsRepository.js";
import { accountExists } from "../../db/repositories/accountingHyperinflationRepository.js";
import {
  findHedgeRelationship,
  insertHedgeRelationship,
  insertHedgeValuation,
  listHedgeRelationships,
  updateHedgeStatus,
} from "../../db/repositories/accountingHedgesRepository.js";

/** Drizzle-backed storage for IFRS 9 hedge relationships (ports & adapters seam). */
export const accountingHedgesRepository = {
  listFiscalYearsByWorkspace,
  accountExists,
  listHedgeRelationships,
  findHedgeRelationship,
  insertHedgeRelationship,
  insertHedgeValuation,
  updateHedgeStatus,
};

export type AccountingHedgesStore = typeof accountingHedgesRepository;
