import { registerFacultyBackgroundJobRunners } from "./jobs/backgroundJobFacultyRunners.js";

/** Registers the faculty background-job runners (called by the app composition root). */
export function createFacultyService(): { registerJobRunners: () => void } {
  return { registerJobRunners: registerFacultyBackgroundJobRunners };
}
