import type { DocumentTemplate } from "@mms/contracts";

/** Flat payload shape passed to TemplateElementContent when rendering student cards. */
export interface StudentCardPayload {
  student_name: string;
  gr_number: string;
  student_id: string;
  roll_number: string;
  session_name: string;
  dob: string;
  gender: string;
  blood_group: string;
  guardian_name: string;
  emergency_phone: string;
  phone: string;
  email: string;
  city: string;
  issue_date: string;
  expiry_date?: string;
  national_id?: string;
  photo?: string;
  card_terms?: string;
  authorized_signature?: string;
  institution_name: string;
  institution_phone: string;
  institution_email: string;
  institution_address: string;
  [key: string]: unknown;
}

export type CardSide = "front" | "back";
export type StudentCardTemplate = DocumentTemplate<StudentCardPayload>;
