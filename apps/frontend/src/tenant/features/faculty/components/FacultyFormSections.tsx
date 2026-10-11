import type React from "react";
import type { FacultyMember, FieldDefinition } from "@mms/shared";

export type {
  FacultySectionBaseProps,
  FacultyStatusOption,
  FacultyEmploymentSectionProps,
} from "./FacultyEmploymentSection";

export { FacultyEmploymentSection } from "./FacultyEmploymentSection";

export {
  FacultyContactSection,
  type FacultyContactSectionProps,
} from "@/tenant/features/faculty/components/FacultyFormContactSection";

/**
 * @deprecated Qualification and specialization are derived directly from the linked contact's profile.
 */
export interface FacultyBasicSectionProps {
  facultyDraft?: Partial<FacultyMember>;
  errors?: Record<string, string>;
  fields?: Record<string, FieldDefinition[]>;
  onDraftChange?: (patch: Partial<FacultyMember>) => void;
  isFieldEnabled?: (fieldId: string) => boolean;
  isFieldRequired?: (fieldId: string) => boolean;
  defaultSpecialization?: string;
  specializationOptions?: string[];
}

/**
 * @deprecated Retired in favor of contact-first education and skills resolution.
 */
export function FacultyBasicSection(_props: FacultyBasicSectionProps): React.JSX.Element | null {
  return null;
}
