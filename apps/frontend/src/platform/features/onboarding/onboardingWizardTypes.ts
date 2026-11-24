import type React from "react";
import { SYSTEM_MODULES, type IndustryType } from "@mms/shared";
import OrganizationDetailsStep from "@/platform/features/onboarding/steps/OrganizationDetailsStep";
import ModulesStep from "@/platform/features/onboarding/steps/ModulesStep";
import StructureStep from "@/platform/features/onboarding/steps/StructureStep";
import AdminSetup from "@/platform/features/onboarding/steps/AdminSetup";
import CompleteStep from "@/platform/features/onboarding/steps/CompleteStep";

/** Provisioning admin gender values (tenant contact lookup values). */
export type AdminGender = "male" | "female";

/** How the tenant super admin receives their first credential. */
export type AdminPasswordMode = "email" | "temporary";

export interface OnboardingData {
  name: string;
  subdomain: string;
  subdomainTouched: boolean;
  firstName: string;
  lastName: string;
  email: string;
  adminGender: AdminGender | "";
  adminPasswordMode: AdminPasswordMode;
  /** Temporary-password mode only. */
  password?: string;
  passwordConfirm?: string;
  /** Platform operator password for step-up on create. */
  currentPassword: string;
  modules: string[];
  /** True once the operator edits the module selection (stops catalog seeding). */
  modulesTouched: boolean;
  industryType: IndustryType;
}

type OnboardingTitleKey =
  | "onboarding.stepOrgTitle"
  | "onboarding.stepModulesTitle"
  | "onboarding.stepStructureTitle"
  | "onboarding.stepAdminTitle"
  | "onboarding.stepCompleteTitle";

type OnboardingSubtitleKey =
  | "onboarding.stepOrgSubtitle"
  | "onboarding.stepModulesSubtitle"
  | "onboarding.stepStructureSubtitle"
  | "onboarding.stepAdminSubtitle"
  | "onboarding.stepCompleteSubtitle";

type OnboardingLabelKey =
  | "onboarding.stepOrgLabel"
  | "onboarding.stepModulesLabel"
  | "onboarding.stepStructureLabel"
  | "onboarding.stepAdminLabel"
  | "onboarding.stepCompleteLabel";

interface OnboardingStep {
  id: number;
  titleKey: OnboardingTitleKey;
  subtitleKey: OnboardingSubtitleKey;
  labelKey: OnboardingLabelKey;
  component: React.ComponentType<{
    data: OnboardingData;
    onChange: React.Dispatch<React.SetStateAction<OnboardingData>>;
  }>;
}

export const ONBOARDING_STEP_DEFS: OnboardingStep[] = [
  {
    id: 1,
    titleKey: "onboarding.stepOrgTitle",
    subtitleKey: "onboarding.stepOrgSubtitle",
    labelKey: "onboarding.stepOrgLabel",
    component: OrganizationDetailsStep,
  },
  {
    id: 2,
    titleKey: "onboarding.stepModulesTitle",
    subtitleKey: "onboarding.stepModulesSubtitle",
    labelKey: "onboarding.stepModulesLabel",
    component: ModulesStep,
  },
  {
    id: 3,
    titleKey: "onboarding.stepStructureTitle",
    subtitleKey: "onboarding.stepStructureSubtitle",
    labelKey: "onboarding.stepStructureLabel",
    component: StructureStep,
  },
  {
    id: 4,
    titleKey: "onboarding.stepAdminTitle",
    subtitleKey: "onboarding.stepAdminSubtitle",
    labelKey: "onboarding.stepAdminLabel",
    component: AdminSetup,
  },
  {
    id: 5,
    titleKey: "onboarding.stepCompleteTitle",
    subtitleKey: "onboarding.stepCompleteSubtitle",
    labelKey: "onboarding.stepCompleteLabel",
    component: CompleteStep,
  },
];

export const ONBOARDING_INITIAL_DATA: OnboardingData = {
  name: "",
  subdomain: "",
  subdomainTouched: false,
  firstName: "",
  lastName: "",
  email: "",
  adminGender: "",
  adminPasswordMode: "email",
  password: "",
  passwordConfirm: "",
  currentPassword: "",

  modules: SYSTEM_MODULES.map((m) => m.id),
  modulesTouched: false,
  industryType: "madrasa",
};
