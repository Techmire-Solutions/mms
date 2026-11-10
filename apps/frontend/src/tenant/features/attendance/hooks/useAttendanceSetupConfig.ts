import {
  composeAttendanceSettings,
  normalizeAttendanceModulePreferences,
  type AttendanceModulePreferences,
  type AttendanceSettings,
} from "@mms/shared";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import {
  fetchAttendancePreferences,
  saveAttendancePreferencesAsync,
  setAttendancePreferencesMemory,
} from "@/tenant/features/attendance/hooks/attendanceSetupConfigApi";
import { attendanceQueryKeys } from "./attendanceQueryKeys.js";

export const ATTENDANCE_PREFERENCES_QUERY_KEY = attendanceQueryKeys.preferences;

const setupConfigHooks = createModuleSetupConfigHooks<AttendanceModulePreferences>({
  preferencesQueryKey: ATTENDANCE_PREFERENCES_QUERY_KEY,
  fetchPreferences: fetchAttendancePreferences,
  savePreferences: saveAttendancePreferencesAsync,
  setPreferencesMemory: setAttendancePreferencesMemory,
  preferencesPlaceholder: () => normalizeAttendanceModulePreferences(null),
});

export const useAttendancePreferencesQuery = setupConfigHooks.usePreferencesQuery;
export const useAttendancePreferencesMutation = setupConfigHooks.usePreferencesMutation;

import { useMemo } from "react";

/** Composed AttendanceSettings from preferences queries. */
export function useComposedAttendanceSettings(): AttendanceSettings {
  const prefsQuery = useAttendancePreferencesQuery();
  return useMemo(
    () => composeAttendanceSettings(null, normalizeAttendanceModulePreferences(prefsQuery.data)),
    [prefsQuery.data],
  );
}
