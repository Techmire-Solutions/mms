import type { BrandingSocialLink } from "@mms/contracts";

/** Input for platform-console tenant onboarding (madrasa + provisioned admin). */
export interface OnboardInput {
  email: string;
  adminName: string;
  /**
   * How the tenant super admin receives their first credential:
   * `email` sends an activation link; `temporary` uses the supplied password.
   */
  adminPasswordMode: "email" | "temporary";
  password?: string;
  origin?: string;
  subdomain: string;
  madrasaName: string;
  tagline?: string;
  country?: string;
  primaryColor?: string;
  secondaryColor?: string;
  logoUrl?: string;
  adminPhone?: string;
  /** Gender collected by the platform wizard; stored on the linked tenant contact. */
  adminGender: "male" | "female";
  website?: string;
  footerText?: string;
  // Extended fields
  faviconUrl?: string;
  legalName?: string;
  registrationNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  region?: string;
  postalCode?: string;
  socialLinks?: BrandingSocialLink[];
  modules?: string[];
  industryType?: string;
}
