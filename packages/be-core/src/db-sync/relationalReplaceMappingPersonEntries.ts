import type { RelationalCollectionMapping } from "./relationalReplaceMappingTypes.js";

/** Person-module collections: contacts, students, faculty, sessions, users + setup prefs. */
export const RELATIONAL_REPLACE_MAPPING_PERSON: Record<string, RelationalCollectionMapping> = {
  users: {
    priority: 900,
    importPath: "./repositories/tenantUserRepository.js",
    fnName: "replaceTenantUsersForWorkspace",
    snapshotFnName: "listAllTenantUsersByWorkspace",
  },
  contacts: {
    priority: 10,
    importPath: "@mms/mod-contacts/backend/repository",
    fnName: "replaceContactsForWorkspace",
    snapshotFnName: "listContactsByWorkspace",
  },
  students: {
    priority: 15,
    importPath: "@mms/mod-students/backend/repository",
    fnName: "replaceStudentsForWorkspace",
    snapshotFnName: "listStudentsByWorkspace",
  },
  faculty: {
    priority: 20,
    importPath: "@mms/mod-faculty/backend/repository",
    fnName: "replaceFacultyForWorkspace",
    snapshotFnName: "listFacultyByWorkspace",
  },
  sessions: {
    // Must run before its dependants (attendance, enrollments, exams, hasanat, finance): a session
    // replace archives stale sessions instead of hard-deleting them (migration 0206 review), and
    // its class rewrite is guarded by those modules' FKs.
    priority: 31,
    importPath: "@mms/mod-sessions/backend/repository",
    fnName: "replaceSessionsForWorkspace",
    snapshotFnName: "listSessionsByWorkspace",
  },
  contact_lookups: {
    priority: 25,
    importPath: "@mms/mod-contacts/backend/repository",
    fnName: "replaceContactLookupsForWorkspace",
    snapshotFnName: "listAllContactLookupsByWorkspace",
  },
  student_lookups: {
    priority: 28,
    importPath: "@mms/mod-students/backend/repository",
    fnName: "replaceStudentLookupsForWorkspace",
    snapshotFnName: "listAllStudentLookupsByWorkspace",
  },
  contact_field_configs: {
    priority: 26,
    importPath: "@mms/mod-contacts/backend/repository",
    fnName: "replaceContactFieldConfigsForWorkspace",
    snapshotFnName: "listAllContactFieldConfigsByWorkspace",
  },
  contact_module_preferences: {
    priority: 27,
    importPath: "@mms/mod-contacts/backend/repository",
    fnName: "replaceContactModulePreferencesForWorkspace",
    snapshotFnName: "listAllContactModulePreferencesByWorkspace",
  },
  student_field_configs: {
    priority: 29,
    importPath: "@mms/mod-students/backend/repository",
    fnName: "replaceStudentFieldConfigsForWorkspace",
    snapshotFnName: "listAllStudentFieldConfigsByWorkspace",
  },
  student_module_preferences: {
    priority: 30,
    importPath: "@mms/mod-students/backend/repository",
    fnName: "replaceStudentModulePreferencesForWorkspace",
    snapshotFnName: "listAllStudentModulePreferencesByWorkspace",
  },
  faculty_lookups: {
    priority: 32,
    importPath: "@mms/mod-faculty/backend/repository",
    fnName: "replaceFacultyLookupsForWorkspace",
    snapshotFnName: "listAllFacultyLookupsByWorkspace",
  },
  faculty_field_configs: {
    priority: 33,
    importPath: "@mms/mod-faculty/backend/repository",
    fnName: "replaceFacultyFieldConfigsForWorkspace",
    snapshotFnName: "listAllFacultyFieldConfigsByWorkspace",
  },
  faculty_module_preferences: {
    priority: 34,
    importPath: "@mms/mod-faculty/backend/repository",
    fnName: "replaceFacultyModulePreferencesForWorkspace",
    snapshotFnName: "listAllFacultyModulePreferencesByWorkspace",
  },
  session_lookups: {
    priority: 35,
    importPath: "@mms/mod-sessions/backend/repository",
    fnName: "replaceSessionLookupsForWorkspace",
    snapshotFnName: "listAllSessionLookupsByWorkspace",
  },
  session_field_configs: {
    priority: 35,
    importPath: "@mms/mod-sessions/backend/repository",
    fnName: "replaceSessionFieldConfigsForWorkspace",
    snapshotFnName: "listAllSessionFieldConfigsByWorkspace",
  },
  session_module_preferences: {
    priority: 35,
    importPath: "@mms/mod-sessions/backend/repository",
    fnName: "replaceSessionModulePreferencesForWorkspace",
    snapshotFnName: "listAllSessionModulePreferencesByWorkspace",
  },
  user_field_configs: {
    priority: 47,
    importPath: "./repositories/userFieldConfigRepository.js",
    fnName: "replaceUserFieldConfigsForWorkspace",
    snapshotFnName: "listAllUserFieldConfigsByWorkspace",
  },
  user_module_preferences: {
    priority: 48,
    importPath: "./repositories/userModulePreferencesRepository.js",
    fnName: "replaceUserModulePreferencesForWorkspace",
    snapshotFnName: "listAllUserModulePreferencesByWorkspace",
  },
  user_ui_preferences: {
    priority: 910,
    importPath: "./repositories/userUiPreferencesRepository.js",
    fnName: "replaceUserUiPreferencesForWorkspace",
    snapshotFnName: "listAllUserUiPreferencesByWorkspace",
  },
};
