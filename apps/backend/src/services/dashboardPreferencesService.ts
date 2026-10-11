import { normalizeDashboardPreferences, type DashboardPreferences } from "@mms/shared";
import {
  getDashboardPreferencesByWorkspace,
  upsertDashboardPreferences,
} from "../db/repositories/dashboardPreferencesRepository.js";
import { createModulePreferencesService } from "../lib/createModulePreferencesService.js";

const service = createModulePreferencesService<DashboardPreferences>({
  broadcastKey: "dashboard",
  getByWorkspace: getDashboardPreferencesByWorkspace,
  upsert: upsertDashboardPreferences,
  normalize: normalizeDashboardPreferences,
});

export const loadDashboardPreferences = service.load;
export const saveDashboardPreferences = service.save;
