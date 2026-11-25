import type { ContactExperience } from "@mms/contracts";

export function createEmptyExperience(
  defaultEmploymentType: string | undefined,
  employmentTypeOptions: string[],
): ContactExperience {
  return {
    id:
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `exp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    title: "",
    organization: "",
    employmentType: defaultEmploymentType || employmentTypeOptions[0] || "",
    location: "",
    startDate: "",
    endDate: "",
    isCurrent: false,
    description: "",
  };
}
