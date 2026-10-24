/**
 * @file industryTypes.ts
 * @description Shared industry type enum (workspace profile / onboarding).
 */

export const INDUSTRY_TYPES = [
  "madrasa",
  "hotel",
  "office",
  "retail",
  "custom",
  "general",
] as const;
export type IndustryType = (typeof INDUSTRY_TYPES)[number];
