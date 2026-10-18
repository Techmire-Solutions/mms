import {
  ATTENDANCE_MODULE_MANIFEST,
  normalizeAttendanceModulePreferences,
  normalizeAttendanceSettings,
  type AttendanceModulePreferences,
  type AttendanceSettings,
} from "@mms/shared";
import { createModuleSetupConfigHooks } from "@/lib/query/createModuleSetupConfigHooks";
import {
  fetchAttendancePreferences,
  saveAttendancePreferencesAsync,
  setAttendancePreferencesMemory,
} from "@/tenant/features/attendance/hooks/attendanceSetupConfigApi";

export const ATTENDANCE_PREFERENCES_QUERY_KEY = [
  ATTENDANCE_MODULE_MANIFEST.collectionKey,
  "preferences",
] as const;

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
  return useMemo(() => normalizeAttendanceSettings(prefsQuery.data), [prefsQuery.data]);
}
