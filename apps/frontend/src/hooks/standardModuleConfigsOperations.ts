import {
  emptyAttendanceLookupsMap,
  normalizeUserModulePreferences,
  normalizeHasanatModulePreferences,
  normalizeFinanceModulePreferences,
  normalizeAccountingModulePreferences,
  normalizeAttendanceModulePreferences,
  type UsersSettings,
  type HasanatSettings,
  type FinanceSettings,
  type AttendanceSettings,
  type AccountingSettings,
} from "@mms/shared";
import {
  createStandardModuleConfigHook,
  type StandardModuleConfigCore,
} from "./createStandardModuleConfigHook";
import {
  STANDARD_MODULES_CONFIG_REGISTRY,
  type StandardModuleConfigExtraMap,
} from "./standardModuleConfigRegistry";
import { useAttendanceLookupsQuery } from "@/tenant/features/attendance/hooks/useAttendanceLookups";
import {
  useComposedUsersSettings,
  useUserPreferencesMutation,
} from "@/tenant/hooks/collections/users";
import {
  useComposedHasanatSettings,
  useHasanatPreferencesMutation,
} from "@/tenant/hooks/collections/hasanat";
import {
  useComposedFinanceSettings,
  useFinancePreferencesMutation,
} from "@/tenant/hooks/collections/finance";
import {
  useComposedAccountingSettings,
  useAccountingPreferencesMutation,
} from "@/tenant/hooks/collections/accounting";
import {
  useComposedAttendanceSettings,
  useAttendancePreferencesMutation,
} from "@/tenant/hooks/collections/attendance";

const useUsersConfigImpl = createStandardModuleConfigHook<UsersSettings, Record<string, never>>({
  defaultSettings: STANDARD_MODULES_CONFIG_REGISTRY.users.defaultSettings as UsersSettings,
  defaultFieldDefs: STANDARD_MODULES_CONFIG_REGISTRY.users.defaultFieldDefs,
  useSettings: useComposedUsersSettings,
  useUpdateSettingsAsync: () => {
    const mutation = useUserPreferencesMutation();
    return async (draft: UsersSettings) => {
      await mutation.mutateAsync(normalizeUserModulePreferences(draft));
    };
  },
});

export function useUsersConfig() {
  return useUsersConfigImpl() as StandardModuleConfigCore<UsersSettings> &
    StandardModuleConfigExtraMap["users"];
}

const useHasanatConfigImpl = createStandardModuleConfigHook<HasanatSettings, Record<string, never>>(
  {
    defaultSettings: STANDARD_MODULES_CONFIG_REGISTRY.hasanat.defaultSettings as HasanatSettings,
    defaultFieldDefs: STANDARD_MODULES_CONFIG_REGISTRY.hasanat.defaultFieldDefs,
    useSettings: useComposedHasanatSettings,
    useUpdateSettingsAsync: () => {
      const mutation = useHasanatPreferencesMutation();
      return async (draft: HasanatSettings) => {
        await mutation.mutateAsync(normalizeHasanatModulePreferences(draft));
      };
    },
  },
);

export function useHasanatConfig() {
  return useHasanatConfigImpl() as StandardModuleConfigCore<HasanatSettings> &
    StandardModuleConfigExtraMap["hasanat"];
}

const useFinanceConfigImpl = createStandardModuleConfigHook<FinanceSettings, Record<string, never>>(
  {
    defaultSettings: STANDARD_MODULES_CONFIG_REGISTRY.finance.defaultSettings as FinanceSettings,
    defaultFieldDefs: STANDARD_MODULES_CONFIG_REGISTRY.finance.defaultFieldDefs,
    useSettings: useComposedFinanceSettings,
    useUpdateSettingsAsync: () => {
      const mutation = useFinancePreferencesMutation();
      return async (draft: FinanceSettings) => {
        await mutation.mutateAsync(normalizeFinanceModulePreferences(draft));
      };
    },
  },
);

export function useFinanceConfig() {
  return useFinanceConfigImpl() as StandardModuleConfigCore<FinanceSettings> &
    StandardModuleConfigExtraMap["finance"];
}

const useAccountingConfigImpl = createStandardModuleConfigHook<
  AccountingSettings,
  Record<string, never>
>({
  defaultSettings: STANDARD_MODULES_CONFIG_REGISTRY.accounting
    .defaultSettings as AccountingSettings,
  defaultFieldDefs: STANDARD_MODULES_CONFIG_REGISTRY.accounting.defaultFieldDefs,
  useSettings: useComposedAccountingSettings,
  useUpdateSettingsAsync: () => {
    const mutation = useAccountingPreferencesMutation();
    return async (draft: AccountingSettings) => {
      await mutation.mutateAsync(normalizeAccountingModulePreferences(draft));
    };
  },
});

export function useAccountingConfig() {
  return useAccountingConfigImpl() as StandardModuleConfigCore<AccountingSettings> &
    StandardModuleConfigExtraMap["accounting"];
}

const useAttendanceConfigImpl = createStandardModuleConfigHook<
  AttendanceSettings,
  { statuses: import("@/lib/data/attendanceData").AttendanceStatus[] }
>({
  defaultSettings: STANDARD_MODULES_CONFIG_REGISTRY.attendance
    .defaultSettings as AttendanceSettings,
  defaultFieldDefs: STANDARD_MODULES_CONFIG_REGISTRY.attendance.defaultFieldDefs,
  useSettings: useComposedAttendanceSettings,
  useUpdateSettingsAsync: () => {
    const mutation = useAttendancePreferencesMutation();
    return async (draft: AttendanceSettings) => {
      await mutation.mutateAsync(normalizeAttendanceModulePreferences(draft));
    };
  },
  lookupsFrom: function useAttendanceConfigLookups() {
    const lookupsQuery = useAttendanceLookupsQuery();
    const lookups = lookupsQuery.data ?? emptyAttendanceLookupsMap;
    return {
      statuses: lookups.statuses,
    };
  },
});

export function useAttendanceConfig() {
  return useAttendanceConfigImpl() as StandardModuleConfigCore<AttendanceSettings> &
    StandardModuleConfigExtraMap["attendance"];
}
