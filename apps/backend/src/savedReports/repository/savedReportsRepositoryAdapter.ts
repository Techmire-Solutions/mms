import {
  createSavedReportForOwner,
  deleteSavedReportByOwner,
  listSavedReportsByOwner,
  touchSavedReportRunByOwner,
} from "../../db/repositories/savedReportsRepository.js";
import type { SavedReportsRepository } from "./savedReportsRepository.js";

/**
 * Drizzle-backed implementation of {@link SavedReportsRepository}. The only file in
 * the saved-reports domain that binds to the concrete storage functions.
 */
export const savedReportsRepositoryAdapter: SavedReportsRepository = {
  listSavedReportsByOwner,
  createSavedReportForOwner,
  deleteSavedReportByOwner,
  touchSavedReportRunByOwner,
};
