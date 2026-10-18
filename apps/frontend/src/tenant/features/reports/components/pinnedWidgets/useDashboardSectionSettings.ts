import { getObject, saveObject } from "@/lib/db";

const DASHBOARD_SECTION_KEY = "dashboard_section_settings";

/** Reads the current boolean state for a given `switchStateKey`. */
export function readDashboardSwitchState(switchStateKey: string): boolean {
  if (switchStateKey.startsWith("section_")) {
    const sectionKey = switchStateKey.replace("section_", "");
    const settings = getObject<Record<string, boolean>>(DASHBOARD_SECTION_KEY, {});
    return !!settings[sectionKey];
  }
  return (
    getObject<unknown>(switchStateKey, false) === true ||
    getObject<unknown>(switchStateKey, "false") === "true"
  );
}

/**
 * Toggles the persisted boolean for a `switchStateKey` and dispatches a
 * `local-database-update` event so all subscribers re-read.
 */
export function toggleDashboardSwitchState(switchStateKey: string): void {
  if (switchStateKey.startsWith("section_")) {
    const sectionKey = switchStateKey.replace("section_", "");
    const settings = getObject<Record<string, boolean>>(DASHBOARD_SECTION_KEY, {});
    settings[sectionKey] = !settings[sectionKey];
    saveObject(DASHBOARD_SECTION_KEY, settings);
  } else {
    const isEnabled = readDashboardSwitchState(switchStateKey);
    saveObject(switchStateKey, !isEnabled);
  }
  window.dispatchEvent(new Event("local-database-update"));
}
