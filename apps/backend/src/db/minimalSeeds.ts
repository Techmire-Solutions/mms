import {
  CONFIG_VERSION,
  DEFAULT_ACCOUNTING_SETTINGS,
  DEFAULT_ADDRESS_LABELS,
  DEFAULT_ATTENDANCE_SETTINGS,
  DEFAULT_ATTENDANCE_STATUSES,
  DEFAULT_BRANDING_SETTINGS,
  DEFAULT_CONTACT_PREFERENCES,
  DEFAULT_CURRENCIES,
  DEFAULT_EMAIL_LABELS,
  DEFAULT_ENABLED_TABS,
  DEFAULT_ENROLLMENTS_SETTINGS,
  DEFAULT_EXAMINATIONS_SETTINGS,
  DEFAULT_FINANCE_SETTINGS,
  DEFAULT_GLOBAL_SETTINGS,
  DEFAULT_PHONE_LABELS,
  DEFAULT_QUESTION_BANK_SETTINGS,
  DEFAULT_REQUIRED_TABS,
  DEFAULT_SESSIONS_SETTINGS,
  GENDERS,
  INITIAL_FIELD_SEED,
  SOCIAL_PLATFORMS,
  curatedContactCountryCodes,
  defaultSessionLookupItems,
} from '@mms/shared';

const EMPTY_TENANT_COLLECTIONS = [
  'studentStatuses',
  'studentGenderFilters',
  'facultyStatuses',
  'facultySpecializations',
  'studentDiscountTypes',
  'relationships',
  'whatsappTemplates',
  'contacts',
  'students',
  'enrollments',
  'sessions',
  'attendance_records',
  'finance_invoices',
  'finance_payments',
  'hasanat_denoms',
  'hasanat_batches',
  'hasanat_distributions',
  'exams',
  'exam_results',
  'users',
  'user_activity_logs',
  'obligation_types',
  'mujtahids',
  'reps',
  'wakala_types',
  'distributions',
  'collections',
  'accounting_accounts',
  'accounting_entries',
  'accounting_fiscal_years',
  'reports_student_list',
  'reports_enrollment_history',
  'revenue_expenses',
  'questions',
  'tests',
  'assessment_results',
  'backups',
] as const;

function clone<T>(value: T): T {
  return structuredClone(value);
}

/** Lookup catalogs plus empty tenant-owned collections for a new workspace. */
export async function getMinimalCollectionsForSeed(): Promise<Record<string, unknown[]>> {
  const minimal: Record<string, unknown[]> = {};
  for (const name of EMPTY_TENANT_COLLECTIONS) {
    minimal[name] = [];
  }

  return {
    ...minimal,
    currencies: clone(DEFAULT_CURRENCIES),
    genders: [...GENDERS],
    socialPlatforms: [...SOCIAL_PLATFORMS],
    phoneLabels: [...DEFAULT_PHONE_LABELS],
    emailLabels: [...DEFAULT_EMAIL_LABELS],
    addressLabels: [...DEFAULT_ADDRESS_LABELS],
    countryCodes: curatedContactCountryCodes(),
    sessionStatuses: [...defaultSessionLookupItems.statuses],
    attendanceStatuses: clone(DEFAULT_ATTENDANCE_STATUSES),
  };
}

export function getMinimalObjects(): Record<string, unknown> {
  const contactFieldConfig = {
    version: CONFIG_VERSION,
    enabledTabs: [...DEFAULT_ENABLED_TABS],
    requiredTabs: [...DEFAULT_REQUIRED_TABS],
    fields: clone(INITIAL_FIELD_SEED),
  };

  return {
    socialPlaceholders: {},
    contact_field_config: contactFieldConfig,
    contact_field_config_default: clone(contactFieldConfig),
    contact_prefs: clone(DEFAULT_CONTACT_PREFERENCES),
    branding: clone(DEFAULT_BRANDING_SETTINGS),
    global_settings: clone(DEFAULT_GLOBAL_SETTINGS),
    sessions_settings: clone(DEFAULT_SESSIONS_SETTINGS),
    enrollments_settings: clone(DEFAULT_ENROLLMENTS_SETTINGS),
    attendance_settings: clone(DEFAULT_ATTENDANCE_SETTINGS),
    examinations_settings: clone(DEFAULT_EXAMINATIONS_SETTINGS),
    finance_settings: clone(DEFAULT_FINANCE_SETTINGS),
    accounting_settings: clone(DEFAULT_ACCOUNTING_SETTINGS),
    question_bank_settings: clone(DEFAULT_QUESTION_BANK_SETTINGS),
  };
}
