export type {
  StandardModuleId,
  StandardModuleSettingsMap,
  StandardModuleConfigExtraMap,
} from "./standardModuleConfigRegistry";
export { STANDARD_MODULES_CONFIG_REGISTRY } from "./standardModuleConfigRegistry";

export {
  useFacultyConfig,
  useStudentConfig,
  useSessionConfig,
  useEnrollmentConfig,
  useExaminationConfig,
} from "./standardModuleConfigsAcademic";

export {
  useUsersConfig,
  useHasanatConfig,
  useFinanceConfig,
  useAccountingConfig,
  useAttendanceConfig,
} from "./standardModuleConfigsOperations";
