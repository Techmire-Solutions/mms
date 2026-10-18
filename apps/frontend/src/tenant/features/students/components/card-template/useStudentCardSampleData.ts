import { useMemo } from "react";
import {
  formatBrandingAddress,
  formatDate,
  type BrandingSettings,
  type Student,
} from "@mms/shared";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { StudentCardPayload } from "../../lib/studentCardTemplateTypes";

const DEMO_STUDENT_PHOTO =
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80";

export interface UseStudentCardSampleDataOptions {
  branding: BrandingSettings;
  sampleStudent?: Student | null;
  sessionNames: string[];
  guardianName?: string;
  emergencyPhone?: string;
  bloodGroup?: string;
  t: TranslationFunction;
}

export function useStudentCardSampleData({
  branding,
  sampleStudent,
  sessionNames,
  guardianName,
  emergencyPhone,
  bloodGroup,
  t,
}: UseStudentCardSampleDataOptions): StudentCardPayload {
  return useMemo<StudentCardPayload>(() => {
    const institutionAddress = formatBrandingAddress(branding) || "123 Seminary Road, Karachi";
    const madrasaName = branding.madrasaName || "Madrasa Management System";
    const studentWithExtras = sampleStudent as
      | {
          avatarUrl?: string;
          photo?: string;
          cnic?: string;
          identificationNumber?: string;
        }
      | null
      | undefined;

    if (sampleStudent) {
      return {
        student_name: sampleStudent.name || "Muhammad Ali Raza",
        gr_number: sampleStudent.grNumber || "2026-0042",
        student_id: String(sampleStudent.studentId || sampleStudent.id || "STU-001"),
        roll_number: "14",
        session_name: sessionNames.length > 0 ? sessionNames.join(", ") : "Dars-e-Nizami Year 2",
        guardian_name: guardianName || sampleStudent.fatherName || "Muhammad Kazim",
        emergency_phone: emergencyPhone || sampleStudent.phone || "+92 300 1234567",
        phone: sampleStudent.phone || "+92 321 7654321",
        email: sampleStudent.email || "ali.student@example.com",
        blood_group: bloodGroup || "O+",
        dob: sampleStudent.dob || "2010-04-15",
        gender: sampleStudent.gender || "Male",
        city: sampleStudent.city || "Karachi",
        national_id:
          studentWithExtras?.cnic || studentWithExtras?.identificationNumber || "42101-1234567-1",
        photo: studentWithExtras?.avatarUrl || studentWithExtras?.photo || DEMO_STUDENT_PHOTO,
        card_terms: t("students.idCard.termsDefault"),
        authorized_signature: t("students.idCard.principalSign"),
        expiry_date: "2027-06-30",
        institution_name: madrasaName,
        institution_phone: branding.phone || "+92 21 34567890",
        institution_email: branding.email || "office@alhuda.edu",
        institution_address: institutionAddress,
        issue_date: formatDate(new Date()),
      };
    }

    return {
      student_name: "Muhammad Ali Raza",
      gr_number: "2026-0042",
      student_id: "STU-0012",
      roll_number: "14",
      session_name: "Dars-e-Nizami Year 2",
      guardian_name: "Muhammad Kazim",
      emergency_phone: "+92 300 1234567",
      phone: "+92 321 7654321",
      email: "ali.student@example.com",
      blood_group: "O+",
      dob: "2010-04-15",
      gender: "Male",
      city: "Karachi",
      national_id: "42101-1234567-1",
      photo: DEMO_STUDENT_PHOTO,
      card_terms: t("students.idCard.termsDefault"),
      authorized_signature: t("students.idCard.principalSign"),
      expiry_date: "2027-06-30",
      institution_name: madrasaName,
      institution_phone: branding.phone || "+92 21 34567890",
      institution_email: branding.email || "office@alhuda.edu",
      institution_address: institutionAddress,
      issue_date: formatDate(new Date()),
    };
  }, [branding, sampleStudent, sessionNames, guardianName, emergencyPhone, bloodGroup, t]);
}
