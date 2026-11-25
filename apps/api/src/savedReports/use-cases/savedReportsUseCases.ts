import type { SavedReportsRepository } from "../repository/savedReportsRepository.js";
import { savedReportsRepositoryAdapter } from "../repository/savedReportsRepositoryAdapter.js";

/**
 * Composition root for owner-scoped saved reports. `repo` is injectable so tests can
 * supply a fake repository without touching Drizzle; production uses the adapter.
 */
export function createSavedReportsUseCases(
  repo: SavedReportsRepository = savedReportsRepositoryAdapter,
): SavedReportsRepository {
  return {
    listSavedReportsByOwner: repo.listSavedReportsByOwner,
    createSavedReportForOwner: repo.createSavedReportForOwner,
    deleteSavedReportByOwner: repo.deleteSavedReportByOwner,
    touchSavedReportRunByOwner: repo.touchSavedReportRunByOwner,
  };
}

export const savedReportsUseCases = createSavedReportsUseCases();

// Named exports let route handlers import the use-case surface directly.
export const {
  listSavedReportsByOwner,
  createSavedReportForOwner,
  deleteSavedReportByOwner,
  touchSavedReportRunByOwner,
} = savedReportsUseCases;
