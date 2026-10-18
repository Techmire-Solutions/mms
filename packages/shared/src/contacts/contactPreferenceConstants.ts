/** Contact preference constants — tabs, palettes, labels, dial codes. */

export const CONFIG_VERSION = 2;

export const DEFAULT_ENABLED_TABS = [
  "phones",
  "emails",
  "addresses",
  "socials",
  "education",
  "experience",
  "skills",
  "relationship",
  "bankDetails",
];
export const DEFAULT_REQUIRED_TABS: string[] = [];

export const GENDERS = ["male", "female"];

export const COLOR_PALETTES = {
  blue: {
    bg: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/20 dark:text-blue-400 dark:border-blue-900/50",
    text: "text-blue-700 dark:text-blue-400",
    border: "border-blue-200 dark:border-blue-900/50",
  },
  emerald: {
    bg: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/50",
    text: "text-emerald-700 dark:text-emerald-400",
    border: "border-emerald-200 dark:border-emerald-900/50",
  },
  violet: {
    bg: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-950/20 dark:text-violet-400 dark:border-violet-900/50",
    text: "text-violet-700 dark:text-violet-400",
    border: "border-violet-200 dark:border-violet-900/50",
  },
  amber: {
    bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/50",
    text: "text-amber-700 dark:text-amber-400",
    border: "border-amber-200 dark:border-amber-900/50",
  },
  rose: {
    bg: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/20 dark:text-rose-400 dark:border-rose-900/50",
    text: "text-rose-700 dark:text-rose-400",
    border: "border-rose-200 dark:border-rose-900/50",
  },
  red: {
    bg: "bg-red-50 text-red-600 border-red-100 dark:bg-red-950/20 dark:text-red-400 dark:border-red-900/50",
    text: "text-red-600 dark:text-red-400",
    border: "border-red-100 dark:border-red-900/50",
  },
  indigo: {
    bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/50",
    text: "text-indigo-700 dark:text-indigo-400",
    border: "border-indigo-200 dark:border-indigo-900/50",
  },
  cyan: {
    bg: "bg-cyan-50 text-cyan-700 border-cyan-200 dark:bg-cyan-950/20 dark:text-cyan-400 dark:border-cyan-900/50",
    text: "text-cyan-700 dark:text-cyan-400",
    border: "border-cyan-200 dark:border-cyan-900/50",
  },
  slate: {
    bg: "bg-muted text-muted-foreground border-border",
    text: "text-muted-foreground",
    border: "border-border",
  },
  /** Semantic aliases — prefer these for status / alert chips (theme-aware). */
  success: {
    bg: "bg-success/10 text-success border-success/20 dark:bg-success/15 dark:border-success/25",
    text: "text-success",
    border: "border-success/20 dark:border-success/25",
  },
  info: {
    bg: "bg-info/10 text-info border-info/20 dark:bg-info/15 dark:border-info/25",
    text: "text-info",
    border: "border-info/20 dark:border-info/25",
  },
  warning: {
    bg: "bg-warning/10 text-warning border-warning/20 dark:bg-warning/15 dark:border-warning/25",
    text: "text-warning",
    border: "border-warning/20 dark:border-warning/25",
  },
  destructive: {
    bg: "bg-destructive/10 text-destructive border-destructive/20 dark:bg-destructive/15 dark:border-destructive/25",
    text: "text-destructive",
    border: "border-destructive/20 dark:border-destructive/25",
  },
};

export const DEFAULT_PHONE_LABELS = ["Mobile", "Home", "Work", "WhatsApp", "Other"];
export const DEFAULT_EMAIL_LABELS = ["Personal", "Work", "Other"];
export const DEFAULT_ADDRESS_LABELS = ["Home", "Work", "Billing", "Other"];
export const DEFAULT_BANK_NAMES = [
  "Meezan Bank",
  "Habib Bank Limited (HBL)",
  "United Bank Limited (UBL)",
  "MCB Bank",
  "Allied Bank Limited (ABL)",
  "Bank Alfalah",
  "Standard Chartered",
  "Dubai Islamic Bank",
  "Faysal Bank",
  "National Bank of Pakistan (NBP)",
  "Other",
];
export const DEFAULT_BANK_LABELS = ["Primary", "Other"];
export const DEFAULT_BANK_CURRENCIES = ["PKR", "USD", "EUR", "GBP", "SAR", "AED", "CAD", "AUD"];
export const DEFAULT_TAG_LABELS = [
  "VIP",
  "Donor",
  "Parent",
  "Scholar",
  "Volunteer",
  "Staff",
  "Student",
  "Other",
];
export const DEFAULT_EDUCATION_DEGREE_LABELS = [
  "Matric / Secondary",
  "Intermediate / HSSC",
  "Bachelor's",
  "Master's",
  "MPhil / PhD",
  "Dars-e-Nizami / Shahadat-ul-Alimiyyah",
  "Diploma / Certification",
  "Other",
];
export const DEFAULT_EMPLOYMENT_TYPE_LABELS = [
  "Full-time",
  "Part-time",
  "Contract",
  "Visiting",
  "Volunteer",
  "Internship",
  "Other",
];
export const DEFAULT_SKILL_CATEGORY_LABELS = [
  "Islamic Studies",
  "Quranic Sciences & Tajweed",
  "Arabic Language",
  "Teaching & Pedagogy",
  "IT & Development",
  "Administration",
  "Other",
];
export const DEFAULT_SKILL_PROFICIENCY_LABELS = [
  "Beginner",
  "Intermediate",
  "Advanced",
  "Master / Expert",
];

export const SOCIAL_PLATFORMS = [
  "Facebook",
  "Twitter / X",
  "Instagram",
  "LinkedIn",
  "TikTok",
  "YouTube",
  "WhatsApp",
  "Telegram",
  "Snapchat",
];

export const COUNTRY_CODES = [
  { country: "Pakistan", code: "+92" },
  { country: "India", code: "+91" },
  { country: "Iran", code: "+98" },
  { country: "Iraq", code: "+964" },
  { country: "United States", code: "+1" },
  { country: "United Kingdom", code: "+44" },
];

/**
 * Names retired from the former expanded Contacts dial-code seed.
 * Presence in a persisted list means it should be replaced with {@link COUNTRY_CODES}.
 */
const RETIRED_CONTACT_COUNTRY_CODE_NAMES = [
  "Canada",
  "Australia",
  "Bangladesh",
  "Egypt",
  "Nigeria",
  "Ghana",
  "Saudi Arabia",
  "United Arab Emirates",
  "Qatar",
  "Kuwait",
  "Bahrain",
  "Oman",
  "Malaysia",
  "Singapore",
  "Thailand",
  "Indonesia",
] as const;

/** True when a persisted dial-code list still contains a retired seed country. */
export function needsContactCountryCodesCurate(
  entries: ReadonlyArray<{ country: string; code: string }>,
): boolean {
  const retired = new Set(RETIRED_CONTACT_COUNTRY_CODE_NAMES.map((name) => name.toLowerCase()));
  return entries.some((entry) => retired.has(entry.country.trim().toLowerCase()));
}

/** Fresh copy of the curated Contacts dial-code seed. */
export function curatedContactCountryCodes(): Array<{ country: string; code: string }> {
  return COUNTRY_CODES.map((entry) => ({ ...entry }));
}
