/**
 * @file savedReportsRepository.ts
 * @description Storage contract for owner-scoped saved reports.
 *
 * Use-cases depend on this interface — never on the concrete Drizzle functions in
 * `db/repositories/*`. The Drizzle-backed adapter is the only implementation.
 */
type SavedReportsModule = typeof import("../../db/repositories/savedReportsRepository.js");

export interface SavedReportsRepository {
  listSavedReportsByOwner: SavedReportsModule["listSavedReportsByOwner"];
  createSavedReportForOwner: SavedReportsModule["createSavedReportForOwner"];
  deleteSavedReportByOwner: SavedReportsModule["deleteSavedReportByOwner"];
  touchSavedReportRunByOwner: SavedReportsModule["touchSavedReportRunByOwner"];
}
