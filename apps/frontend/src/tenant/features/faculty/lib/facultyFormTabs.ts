import { useState, useEffect, useMemo } from "react";
import { Award, Briefcase, User, type LucideIcon } from "lucide-react";
import type {
  Contact,
  FacultyMember,
  FacultyDesignationDefinition,
  FacultyDepartmentEntity,
  FieldDefinition,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { focusFacultyValidationField } from "@/tenant/features/faculty/components/facultyFormValidation";
import type { FacultyStatusOption } from "@/tenant/features/faculty/components/FacultyFormSections";
import type {
  FacultyUserAccountDraft,
  LinkedUserInfo,
} from "@/tenant/features/faculty/components/FacultyUserAccountSection";

export type FacultyFormTabKey = "contact" | "employment" | "designation" | "account" | "notes";

export const FACULTY_FIELD_TAB_MAP: Record<string, FacultyFormTabKey> = {
  contactId: "contact",
  employeeId: "employment",
  status: "employment",
  joinDate: "employment",
  employmentStartDate: "employment",
  employmentEndDate: "employment",
  department: "designation",
  departmentId: "designation",
  specialization: "contact",
  qualification: "contact",
  designation: "designation",
  designationId: "designation",
  designationStartDate: "designation",
  designationEndDate: "designation",
  employDesignationStatus: "designation",
  profileStatus: "designation",
  parentDesignationId: "designation",
  reportingFacultyId: "designation",
  hierarchyRank: "designation",
  notes: "notes",
  "user.role": "account",
  "user.email": "account",
  "user.password": "account",
  "user.create": "account",
  userPassword: "account",
  userEmail: "account",
  userRole: "account",
  userId: "account",
};

export interface FormTabItem {
  key: FacultyFormTabKey;
  icon: LucideIcon;
  label: string;
  badge?: number;
  tone?: "destructive";
}

export interface FacultyFormTabContentProps {
  formInstanceId: string;
  activeTab?: string;
  faculty?: FacultyMember;
  facultyDraft?: Partial<FacultyMember>;
  errors: Record<string, string>;
  fields: Record<string, FieldDefinition[]>;
  linkedFacultyContactIds?: Array<string | number>;
  /** Legacy flat-string department options (from faculty_lookups). */
  departmentOptions?: string[];
  /** Normalized department catalog entities (from faculty_departments table). */
  departmentEntities?: FacultyDepartmentEntity[];
  designationOptions?: FacultyDesignationDefinition[];
  autoGenerateId: boolean;
  idPrefix: string;
  nextEmployeeId?: string;
  onRegenerateEmployeeId?: () => void;
  isFetchingNextEmployeeId?: boolean;
  statusOptions: FacultyStatusOption[];
  isFieldEnabled: (fieldId: string) => boolean;
  isFieldRequired: (fieldId: string) => boolean;
  getFieldError: (fieldId: string) => string | undefined;
  onDraftChange: (patch: Partial<FacultyMember>) => void;
  linkedContact?: Contact | null;
  linkedUser?: LinkedUserInfo | null;
  userAccountDraft?: FacultyUserAccountDraft;
  onUserAccountDraftChange?: (draft: FacultyUserAccountDraft) => void;
}

export function useFacultyFormTabs(input: {
  isFieldEnabled: (fieldId: string) => boolean;
  errors: Record<string, string>;
  t: TranslationFunction;
  formInstanceId: string;
}) {
  const { isFieldEnabled, errors, t, formInstanceId } = input;
  const [activeTab, setActiveTab] = useState<FacultyFormTabKey>("contact");

  const tabErrors = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const [fieldId, errorMsg] of Object.entries(errors)) {
      if (!errorMsg) continue;
      const tabKey = FACULTY_FIELD_TAB_MAP[fieldId] || "employment";
      counts[tabKey] = (counts[tabKey] || 0) + 1;
    }
    return counts;
  }, [errors]);

  const visibleTabs = useMemo(() => {
    const list: FormTabItem[] = [
      { key: "contact", icon: User, label: t("faculty.form.tab.contact") },
      { key: "employment", icon: Briefcase, label: t("faculty.form.tab.employment") },
    ];

    if (
      isFieldEnabled("designation") ||
      isFieldEnabled("department") ||
      isFieldEnabled("designationId") ||
      isFieldEnabled("departmentId")
    ) {
      list.push({
        key: "designation",
        icon: Award,
        label: t("faculty.form.tab.designation"),
      });
    }
    return list.map((item) => {
      const errCount = tabErrors[item.key];
      const hasErrors = Boolean(errCount && errCount > 0);
      return {
        ...item,
        badge: hasErrors ? errCount : undefined,
        tone: hasErrors ? ("destructive" as const) : undefined,
      };
    });
  }, [isFieldEnabled, t, tabErrors]);

  useEffect(() => {
    if (!visibleTabs.some((tabItem) => tabItem.key === activeTab)) {
      setActiveTab("contact");
    }
  }, [visibleTabs, activeTab]);

  useEffect(() => {
    const errorKeys = Object.keys(errors).filter((key) => Boolean(errors[key]));
    if (errorKeys.length === 0) return;
    const firstInvalidTab = visibleTabs.find((vt) =>
      Boolean(tabErrors[vt.key] && tabErrors[vt.key] > 0),
    );
    if (firstInvalidTab && firstInvalidTab.key !== activeTab) {
      setActiveTab(firstInvalidTab.key);
    }
  }, [errors, tabErrors, activeTab, visibleTabs]);

  useEffect(() => {
    const errorKeys = Object.keys(errors).filter((key) => Boolean(errors[key]));
    if (errorKeys.length === 0) return;
    const fieldForActiveTab = errorKeys.find(
      (key) => (FACULTY_FIELD_TAB_MAP[key] || "employment") === activeTab,
    );
    if (!fieldForActiveTab) return;
    const timer = setTimeout(() => {
      focusFacultyValidationField(formInstanceId, fieldForActiveTab);
    }, 60);
    return () => clearTimeout(timer);
  }, [activeTab, errors, formInstanceId]);

  return { activeTab, setActiveTab, visibleTabs };
}
