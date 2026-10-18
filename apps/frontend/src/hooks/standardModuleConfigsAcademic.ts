import { activeAcademicCatalogItems } from '@mms/shared';
import { useAcademicCatalogItems } from '@/hooks/useAcademicCatalog';
import { useMemo } from 'react';
import type { ModuleCustomField } from '@mms/shared';
import {
  getSortedFacultyFields,
  listEnabledCustomFacultyFormFields,
  resolveFacultyFieldsMapForColumnSync,
  emptyStudentLookupsMap,
  emptySessionLookupsMap,
  emptyFacultyLookupsMap,
  normalizeFacultyModulePreferences,
  normalizeStudentModulePreferences,
  normalizeSessionModulePreferences,
  normalizeEnrollmentModulePreferences,
  normalizeExaminationsModulePreferences,
  type SessionsSettings,
  type StudentsSettings,
  type FacultySettings,
  type EnrollmentsSettings,
  type ExaminationsSettings,
} from '@mms/shared';
import { createStandardModuleConfigHook, type StandardModuleConfigCore } from './createStandardModuleConfigHook';
import {
  STANDARD_MODULES_CONFIG_REGISTRY,
  type StandardModuleConfigExtraMap,
} from './standardModuleConfigRegistry';
import { useSessionLookupsQuery } from '@/tenant/features/sessions/hooks/useSessionLookups';
import { useStudentLookupsQuery } from '@/tenant/features/students/hooks/useStudentLookups';
import {
  useComposedFacultySettings,
  useFacultyPreferencesMutation,
  useFacultyLookupsQuery,
} from '@/tenant/hooks/collections/faculty';
import {
  useComposedStudentsSettings,
  useStudentPreferencesMutation,
} from '@/tenant/hooks/collections/students';
import {
  useComposedSessionsSettings,
  useSessionPreferencesMutation,
} from '@/tenant/hooks/collections/sessions';
import {
  useComposedEnrollmentsSettings,
  useEnrollmentPreferencesMutation,
} from '@/tenant/hooks/collections/enrollments';
import {
  useComposedExaminationsSettings,
  useExaminationPreferencesMutation,
} from '@/tenant/hooks/collections/examinations';

const DEFAULT_EMPTY_FACULTY_LOOKUPS_MAP = emptyFacultyLookupsMap();

const useFacultyConfigImpl = createStandardModuleConfigHook<
  FacultySettings,
  { statuses: string[]; specializations: string[]; genderFilters: string[] }
>({
  defaultSettings: STANDARD_MODULES_CONFIG_REGISTRY.faculty.defaultSettings as FacultySettings,
  defaultFieldDefs: STANDARD_MODULES_CONFIG_REGISTRY.faculty.defaultFieldDefs,
  useSettings: useComposedFacultySettings,
  useUpdateSettingsAsync: () => {
    const mutation = useFacultyPreferencesMutation();
    return async (draft: FacultySettings) => {
      await mutation.mutateAsync(normalizeFacultyModulePreferences(draft));
    };
  },
  customFieldsFrom: (settings) =>
    listEnabledCustomFacultyFormFields(resolveFacultyFieldsMapForColumnSync(settings.fields)).map(
      (field) => ({
        id: field.key,
        label: field.label,
        type: field.type,
        required: field.required,
        options: field.options,
      }),
    ) as ModuleCustomField[],
  orderedFieldsFrom: ({ fieldOrder, settings }) =>
    getSortedFacultyFields(fieldOrder, settings.fields),
  lookupsFrom: function useFacultyConfigLookups() {
    const lookupsQuery = useFacultyLookupsQuery();
    const lookups = lookupsQuery.data ?? DEFAULT_EMPTY_FACULTY_LOOKUPS_MAP;
    return useMemo(
      () => ({
        statuses: lookups.statuses,
        specializations: lookups.specializations,
        genderFilters: lookups.genderFilters,
      }),
      [lookups],
    );
  },
});

export function useFacultyConfig() {
  return useFacultyConfigImpl() as StandardModuleConfigCore<FacultySettings> &
    StandardModuleConfigExtraMap['faculty'];
}



const useStudentConfigImpl = createStandardModuleConfigHook<
  StudentsSettings,
  { statuses: string[]; genderFilters: string[]; discountTypes: string[] }
>({
  defaultSettings: STANDARD_MODULES_CONFIG_REGISTRY.students.defaultSettings as StudentsSettings,
  defaultFieldDefs: STANDARD_MODULES_CONFIG_REGISTRY.students.defaultFieldDefs,
  useSettings: useComposedStudentsSettings,
  useUpdateSettingsAsync: () => {
    const mutation = useStudentPreferencesMutation();
    return async (draft: StudentsSettings) => {
      await mutation.mutateAsync(normalizeStudentModulePreferences(draft));
    };
  },
  lookupsFrom: function useStudentConfigLookups() {
    const lookupsQuery = useStudentLookupsQuery();
    const lookups = lookupsQuery.data ?? emptyStudentLookupsMap();
    return {
      statuses: lookups.statuses,
      genderFilters: lookups.genderFilters,
      discountTypes: lookups.discountTypes,
    };
  },
});

export function useStudentConfig() {
  return useStudentConfigImpl() as StandardModuleConfigCore<StudentsSettings> &
    StandardModuleConfigExtraMap['students'];
}

const useSessionConfigImpl = createStandardModuleConfigHook<
  SessionsSettings,
  { statuses: string[]; types: string[] }
>({
  defaultSettings: STANDARD_MODULES_CONFIG_REGISTRY.sessions.defaultSettings as SessionsSettings,
  defaultFieldDefs: STANDARD_MODULES_CONFIG_REGISTRY.sessions.defaultFieldDefs,
  useSettings: useComposedSessionsSettings,
  useUpdateSettingsAsync: () => {
    const mutation = useSessionPreferencesMutation();
    return async (draft: SessionsSettings) => {
      await mutation.mutateAsync(normalizeSessionModulePreferences(draft));
    };
  },
  lookupsFrom: function useSessionConfigLookups() {
    const lookupsQuery = useSessionLookupsQuery();
    const lookups = lookupsQuery.data ?? emptySessionLookupsMap;
    const programsQuery = useAcademicCatalogItems('programs');
    return {
      statuses: lookups.statuses,
      /** Active Program names (the session `type` snapshot mirrors the program name). */
      types: activeAcademicCatalogItems(programsQuery.data ?? []).map((program) => program.name),
    };
  },
});

export function useSessionConfig() {
  return useSessionConfigImpl() as StandardModuleConfigCore<SessionsSettings> &
    StandardModuleConfigExtraMap['sessions'];
}

const useEnrollmentConfigImpl = createStandardModuleConfigHook<
  EnrollmentsSettings,
  Record<string, never>
>({
  defaultSettings: STANDARD_MODULES_CONFIG_REGISTRY.enrollments.defaultSettings as EnrollmentsSettings,
  defaultFieldDefs: STANDARD_MODULES_CONFIG_REGISTRY.enrollments.defaultFieldDefs,
  useSettings: useComposedEnrollmentsSettings,
  useUpdateSettingsAsync: () => {
    const mutation = useEnrollmentPreferencesMutation();
    return async (draft: EnrollmentsSettings) => {
      await mutation.mutateAsync(normalizeEnrollmentModulePreferences(draft));
    };
  },
});

export function useEnrollmentConfig() {
  return useEnrollmentConfigImpl() as StandardModuleConfigCore<EnrollmentsSettings> &
    StandardModuleConfigExtraMap['enrollments'];
}

const useExaminationConfigImpl = createStandardModuleConfigHook<
  ExaminationsSettings,
  Record<string, never>
>({
  defaultSettings: STANDARD_MODULES_CONFIG_REGISTRY.examinations.defaultSettings as ExaminationsSettings,
  defaultFieldDefs: STANDARD_MODULES_CONFIG_REGISTRY.examinations.defaultFieldDefs,
  useSettings: useComposedExaminationsSettings,
  useUpdateSettingsAsync: () => {
    const mutation = useExaminationPreferencesMutation();
    return async (draft: ExaminationsSettings) => {
      await mutation.mutateAsync(normalizeExaminationsModulePreferences(draft));
    };
  },
});

export function useExaminationConfig() {
  return useExaminationConfigImpl() as StandardModuleConfigCore<ExaminationsSettings> &
    StandardModuleConfigExtraMap['examinations'];
}
