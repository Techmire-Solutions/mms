import {
  composeAttendanceSettings,
  normalizeAttendanceModulePreferences,
  normalizeAttendanceSettings,
  stripAttendanceFieldConfigForPersist,
  type FieldDefinition,
  type AttendanceSettings,
  type TabDefinition,
} from "@mms/shared";
import { createModuleFieldConfigService } from "../lib/createModuleFieldConfigService.js";
import {
  getAttendanceFieldConfig,
  setAttendanceFieldConfig,
} from "../db/repositories/attendanceFieldConfigRepository.js";
import { getAttendanceModulePreferences } from "../db/repositories/attendanceModulePreferencesRepository.js";

const attendanceFieldConfig = createModuleFieldConfigService<
  Record<string, unknown>,
  AttendanceSettings,
  TabDefinition,
  Record<string, FieldDefinition[]> | undefined,
  ReturnType<typeof stripAttendanceFieldConfigForPersist>
>({
  broadcastKey: "attendance",
  getByWorkspace: getAttendanceFieldConfig,
  upsert: setAttendanceFieldConfig,
  toDocument: async (raw, tenant) => {
    const prefs = await getAttendanceModulePreferences(tenant);
    return composeAttendanceSettings(
      normalizeAttendanceSettings(raw),
      normalizeAttendanceModulePreferences(prefs),
    );
  },
  stripForPersist: stripAttendanceFieldConfigForPersist,
  reloadFailedMessage: "Failed to reload attendance field config after save",
});

export const getAttendanceFieldConfigService = attendanceFieldConfig.load;

export async function updateAttendanceFieldConfigService(
  config: AttendanceSettings | Record<string, unknown>,
): Promise<AttendanceSettings> {
  return attendanceFieldConfig.save(normalizeAttendanceSettings(config));
}
