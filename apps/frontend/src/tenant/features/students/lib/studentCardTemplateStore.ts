/**
 * @file studentCardTemplateStore.ts
 * @description Student ID-card layout: field catalog and server-backed hooks.
 *
 * The card has two layouts (front/back) stored as one `document_templates` row
 * (`elements` + `backElements`). Persistence is `/api/templates/:key`; this module
 * keeps no local store or event bus of its own.
 */

import { useMemo } from "react";
import { STUDENT_CARD_TEMPLATE_OBJECT_KEY, type TemplateFieldDefinition } from "@mms/shared";
import { useDocumentTemplate, useSaveDocumentTemplate } from "@/lib/templates/useDocumentTemplates";
import type { BrandingInfo } from "@/lib/invoiceTemplateStore";
import { getDefaultStudentCardTemplate } from "./studentCardTemplateDefaults";
import type { StudentCardPayload, StudentCardTemplate } from "./studentCardTemplateTypes";

/** Server-side key for the ID-card layout (front + back). */
export const STUDENT_CARD_TEMPLATE_KEY = STUDENT_CARD_TEMPLATE_OBJECT_KEY;

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

/** Server-backed layout for print previews; cached locally for first paint. */
export function useStudentCardTemplate(branding?: BrandingInfo): {
  template: StudentCardTemplate;
} {
  const fallback = useMemo(() => getDefaultStudentCardTemplate(branding), [branding]);
  const { template } = useDocumentTemplate<StudentCardPayload>(STUDENT_CARD_TEMPLATE_KEY, fallback);
  return { template };
}

/** Mutation used by the card-template editor. */
export function useSaveStudentCardTemplate() {
  return useSaveDocumentTemplate<StudentCardPayload>(STUDENT_CARD_TEMPLATE_KEY);
}
