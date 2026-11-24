/**
 * Curated phone metadata for supported dial codes.
 * Exact subscriber digit counts exclude the country dial code and leading trunk zeros.
 */

export interface CountryPhoneRule {
  country: string;
  code: string; // Dial code with leading "+", e.g. "+92"
  lengths: number[]; // Allowed national subscriber digit lengths, e.g. [10]
  leadingZeroAllowed?: boolean; // True if national trunk prefix 0 is commonly dialed locally
}

export const COUNTRY_PHONE_RULES: readonly CountryPhoneRule[] = [
  { country: "Pakistan", code: "+92", lengths: [10], leadingZeroAllowed: true },
  { country: "United States", code: "+1", lengths: [10], leadingZeroAllowed: false },
  { country: "Canada", code: "+1", lengths: [10], leadingZeroAllowed: false },
  { country: "United Kingdom", code: "+44", lengths: [10], leadingZeroAllowed: true },
  { country: "India", code: "+91", lengths: [10], leadingZeroAllowed: true },
  { country: "United Arab Emirates", code: "+971", lengths: [9], leadingZeroAllowed: true },
  { country: "Saudi Arabia", code: "+966", lengths: [9], leadingZeroAllowed: true },
  { country: "Iran", code: "+98", lengths: [10], leadingZeroAllowed: true },
  { country: "Iraq", code: "+964", lengths: [10], leadingZeroAllowed: true },
  { country: "Australia", code: "+61", lengths: [9], leadingZeroAllowed: true },
  { country: "Bangladesh", code: "+880", lengths: [10], leadingZeroAllowed: true },
  { country: "Egypt", code: "+20", lengths: [10], leadingZeroAllowed: true },
  { country: "Nigeria", code: "+234", lengths: [10], leadingZeroAllowed: true },
  { country: "Ghana", code: "+233", lengths: [9], leadingZeroAllowed: true },
  { country: "Qatar", code: "+974", lengths: [8], leadingZeroAllowed: false },
  { country: "Kuwait", code: "+965", lengths: [8], leadingZeroAllowed: false },
  { country: "Bahrain", code: "+973", lengths: [8], leadingZeroAllowed: false },
  { country: "Oman", code: "+968", lengths: [8], leadingZeroAllowed: false },
  { country: "Singapore", code: "+65", lengths: [8], leadingZeroAllowed: false },
  { country: "Malaysia", code: "+60", lengths: [9, 10], leadingZeroAllowed: true },
  { country: "Thailand", code: "+66", lengths: [9], leadingZeroAllowed: true },
  { country: "Indonesia", code: "+62", lengths: [10, 11, 12], leadingZeroAllowed: true },
  { country: "Turkey", code: "+90", lengths: [10], leadingZeroAllowed: true },
  { country: "Germany", code: "+49", lengths: [10, 11], leadingZeroAllowed: true },
  { country: "France", code: "+33", lengths: [9], leadingZeroAllowed: true },
  { country: "Italy", code: "+39", lengths: [10], leadingZeroAllowed: false },
  { country: "Spain", code: "+34", lengths: [9], leadingZeroAllowed: false },
  { country: "China", code: "+86", lengths: [11], leadingZeroAllowed: true },
  { country: "Japan", code: "+81", lengths: [10], leadingZeroAllowed: true },
  { country: "South Korea", code: "+82", lengths: [9, 10], leadingZeroAllowed: true },
  { country: "South Africa", code: "+27", lengths: [9], leadingZeroAllowed: true },
  { country: "Kenya", code: "+254", lengths: [9], leadingZeroAllowed: true },
  { country: "Brazil", code: "+55", lengths: [10, 11], leadingZeroAllowed: true },
  { country: "Mexico", code: "+52", lengths: [10], leadingZeroAllowed: true },
  { country: "New Zealand", code: "+64", lengths: [8, 9, 10], leadingZeroAllowed: true },
  { country: "Philippines", code: "+63", lengths: [10], leadingZeroAllowed: true },
  { country: "Sri Lanka", code: "+94", lengths: [9], leadingZeroAllowed: true },
  { country: "Afghanistan", code: "+93", lengths: [9], leadingZeroAllowed: true },
  { country: "Jordan", code: "+962", lengths: [9], leadingZeroAllowed: true },
  { country: "Lebanon", code: "+961", lengths: [7, 8], leadingZeroAllowed: true },
  { country: "Yemen", code: "+967", lengths: [9], leadingZeroAllowed: true },
  { country: "Palestine", code: "+970", lengths: [9], leadingZeroAllowed: true },
  { country: "Syria", code: "+963", lengths: [9], leadingZeroAllowed: true },
] as const;

/** Fallback rule when dial code is not in the curated table (ITU-T E.164 boundary). */
export const FALLBACK_PHONE_RULE: CountryPhoneRule = {
  country: "International",
  code: "",
  lengths: [6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  leadingZeroAllowed: true,
};
