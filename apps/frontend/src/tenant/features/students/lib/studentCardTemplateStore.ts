import { useCallback, useSyncExternalStore } from "react";
import {
  STUDENT_CARD_TEMPLATE_OBJECT_KEY,
  documentTemplateSchema,
  type TemplateFieldDefinition,
} from "@mms/shared";
import { getObject, saveObject } from "@/lib/db";
import type { BrandingInfo } from "@/lib/invoiceTemplateStore";
import type { StudentCardPayload, StudentCardTemplate } from "./studentCardTemplateTypes";
import { getDefaultStudentCardTemplate } from "./studentCardTemplateDefaults";
import { getAvailableStudentCardPresets } from "./studentCardTemplatePresets";

export const STUDENT_CARD_TEMPLATE_CHANGED_EVENT = "mms:student-card-template-changed";
const STORAGE_KEY = STUDENT_CARD_TEMPLATE_OBJECT_KEY;

export const AVAILABLE_STUDENT_CARD_FIELDS: TemplateFieldDefinition<StudentCardPayload>[] = [
  { field: "photo", label: "Student Photo", category: "Student", sampleValue: "" },
  {
    field: "student_name",
    label: "Student Name",
    category: "Student",
    sampleValue: "Muhammad Ali Raza",
  },
  { field: "gr_number", label: "G.R. Number", category: "Student", sampleValue: "2026-0042" },
  { field: "student_id", label: "Student ID", category: "Student", sampleValue: "STU-0012" },
  { field: "roll_number", label: "Roll Number", category: "Academic", sampleValue: "14" },
  {
    field: "session_name",
    label: "Class / Session",
    category: "Academic",
    sampleValue: "Dars-e-Nizami Year 2",
  },
  {
    field: "guardian_name",
    label: "Guardian Name",
    category: "Guardian",
    sampleValue: "Muhammad Kazim",
  },
  {
    field: "emergency_phone",
    label: "Emergency Contact",
    category: "Contact",
    sampleValue: "+92 300 1234567",
  },
  { field: "phone", label: "Student Phone", category: "Contact", sampleValue: "+92 321 7654321" },
  {
    field: "email",
    label: "Student Email",
    category: "Contact",
    sampleValue: "ali.student@example.com",
  },
  { field: "blood_group", label: "Blood Group", category: "Medical", sampleValue: "O+" },
  { field: "dob", label: "Date of Birth", category: "Personal", sampleValue: "2010-04-15" },
  { field: "gender", label: "Gender", category: "Personal", sampleValue: "Male" },
  {
    field: "national_id",
    label: "National ID / CNIC",
    category: "Personal",
    sampleValue: "42101-1234567-1",
  },
  { field: "city", label: "City", category: "Personal", sampleValue: "Karachi" },
  {
    field: "institution_name",
    label: "Institution Name",
    category: "Institution",
    sampleValue: "Madrasa Al-Huda",
  },
  {
    field: "institution_phone",
    label: "Institution Phone",
    category: "Institution",
    sampleValue: "+92 21 34567890",
  },
  {
    field: "institution_email",
    label: "Institution Email",
    category: "Institution",
    sampleValue: "office@alhuda.edu",
  },
  {
    field: "institution_address",
    label: "Institution Address",
    category: "Institution",
    sampleValue: "123 Seminary Road, Karachi",
  },
  {
    field: "card_terms",
    label: "Card Terms & Rules",
    category: "Card Info",
    sampleValue:
      "This card is property of the institution. If found, please return to the address above.",
  },
  {
    field: "authorized_signature",
    label: "Authorized Signature",
    category: "Card Info",
    sampleValue: "Principal / Authorized Signatory",
  },
  { field: "issue_date", label: "Issue Date", category: "Card Info", sampleValue: "2026-09-16" },
  {
    field: "expiry_date",
    label: "Valid Until / Expiry",
    category: "Card Info",
    sampleValue: "2027-06-30",
  },
];

let cachedTemplate: StudentCardTemplate | null = null;
let defaultSnapshot: StudentCardTemplate | null = null;
const listeners = new Set<() => void>();

function notifyListeners(): void {
  listeners.forEach((listener) => listener());
}

function handleWindowUpdate(e?: Event): void {
  if (
    e instanceof CustomEvent &&
    e.detail &&
    typeof e.detail === "object" &&
    Array.isArray(e.detail.elements)
  ) {
    cachedTemplate = e.detail as StudentCardTemplate;
  } else {
    cachedTemplate = loadStudentCardTemplate();
  }
  notifyListeners();
}

function handleStorage(e: StorageEvent): void {
  if (e.key === STORAGE_KEY) {
    cachedTemplate = loadStudentCardTemplate();
    notifyListeners();
  }
}

function setupGlobalListeners(): void {
  if (typeof window !== "undefined") {
    window.addEventListener(STUDENT_CARD_TEMPLATE_CHANGED_EVENT, handleWindowUpdate);
    window.addEventListener("storage", handleStorage);
  }
}

function teardownGlobalListeners(): void {
  if (typeof window !== "undefined") {
    window.removeEventListener(STUDENT_CARD_TEMPLATE_CHANGED_EVENT, handleWindowUpdate);
    window.removeEventListener("storage", handleStorage);
  }
}

/**
 * Loads the current student card template from cache or database object store.
 */
export function loadStudentCardTemplate(branding?: BrandingInfo): StudentCardTemplate {
  const fallback = getDefaultStudentCardTemplate(branding);
  const loaded = getObject<StudentCardTemplate>(STORAGE_KEY, fallback);
  const parsed = documentTemplateSchema.safeParse(loaded);
  return parsed.success ? (parsed.data as StudentCardTemplate) : fallback;
}

/**
 * Saves/updates the student card template after verifying structural validity.
 */
export function saveStudentCardTemplate(tmpl: StudentCardTemplate): void {
  const parsed = documentTemplateSchema.safeParse(tmpl);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new TypeError(
      `Cannot save invalid student card template: missing pageSize or elements array. ${detail}`,
    );
  }
  const validTemplate = parsed.data as StudentCardTemplate;
  saveObject(STORAGE_KEY, validTemplate);
  cachedTemplate = validTemplate;
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent(STUDENT_CARD_TEMPLATE_CHANGED_EVENT, { detail: validTemplate }),
    );
  }
  notifyListeners();
}

/**
 * Resets local student card template back to system defaults.
 */
export function resetStudentCardTemplate(branding?: BrandingInfo): StudentCardTemplate {
  const defaultTmpl = getDefaultStudentCardTemplate(branding);
  saveStudentCardTemplate(defaultTmpl);
  return defaultTmpl;
}

export interface UseStudentCardTemplateReturn {
  template: StudentCardTemplate;
  saveTemplate: (tmpl: StudentCardTemplate) => void;
  resetTemplate: () => StudentCardTemplate;
  applyPreset: (presetKey: string) => StudentCardTemplate | null;
}

/**
 * React hook subscribing to live student card template changes across tabs and windows.
 */
export function useStudentCardTemplate(branding?: BrandingInfo): UseStudentCardTemplateReturn {
  const subscribe = useCallback((listener: () => void) => {
    if (listeners.size === 0) {
      setupGlobalListeners();
    }
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
      if (listeners.size === 0) {
        teardownGlobalListeners();
      }
    };
  }, []);

  const getSnapshot = useCallback((): StudentCardTemplate => {
    if (!cachedTemplate) {
      cachedTemplate = loadStudentCardTemplate(branding);
    }
    return cachedTemplate;
  }, [branding]);

  const getServerSnapshot = useCallback((): StudentCardTemplate => {
    if (!defaultSnapshot) {
      defaultSnapshot = getDefaultStudentCardTemplate(branding);
    }
    return defaultSnapshot;
  }, [branding]);

  const template = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const handleSave = useCallback((tmpl: StudentCardTemplate) => {
    saveStudentCardTemplate(tmpl);
  }, []);

  const handleReset = useCallback(() => {
    return resetStudentCardTemplate(branding);
  }, [branding]);

  const handleApplyPreset = useCallback(
    (presetKey: string) => {
      const presets = getAvailableStudentCardPresets(branding);
      const target = presets.find((p) => p.key === presetKey);
      if (target) {
        saveStudentCardTemplate(target.template);
        return target.template;
      }
      return null;
    },
    [branding],
  );

  return {
    template,
    saveTemplate: handleSave,
    resetTemplate: handleReset,
    applyPreset: handleApplyPreset,
  };
}
