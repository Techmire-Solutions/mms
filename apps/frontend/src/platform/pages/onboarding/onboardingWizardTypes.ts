import type React from "react";
import { SYSTEM_MODULES, type IndustryType } from "@mms/shared";
import OrganizationDetailsStep from "@/platform/pages/onboarding/steps/OrganizationDetailsStep";
import ModulesStep from "@/platform/pages/onboarding/steps/ModulesStep";
import StructureStep from "@/platform/pages/onboarding/steps/StructureStep";
import AdminSetup from "@/platform/pages/onboarding/steps/AdminSetup";
import CompleteStep from "@/platform/pages/onboarding/steps/CompleteStep";

export interface OnboardingData {
  name: string;
  subdomain: string;
  subdomainTouched: boolean;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  confirmPassword?: string;
  /** Platform operator password for step-up on create. */
  currentPassword: string;
  agreedTerms: boolean;
  modules: string[];
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
  password: "",
  confirmPassword: "",
  currentPassword: "",
  agreedTerms: false,
  modules: SYSTEM_MODULES.map((m) => m.id),
  industryType: "madrasa",
};
