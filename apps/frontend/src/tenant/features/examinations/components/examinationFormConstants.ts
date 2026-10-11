import type { AppTranslationKey } from "@mms/shared";
import { type Exam } from "@/lib/data/examinationData";

export const EXAMINATION_SUBJECT_OPTIONS: ReadonlyArray<{
  value: string;
  labelKey: AppTranslationKey;
}> = [
  { value: "Tajweed", labelKey: "examinations.subjects.tajweed" },
  { value: "Hifz", labelKey: "examinations.subjects.hifz" },
  { value: "Islamic Studies", labelKey: "examinations.subjects.islamicStudies" },
  { value: "Arabic", labelKey: "examinations.subjects.arabic" },
  { value: "Aqeedah", labelKey: "examinations.subjects.aqeedah" },
  { value: "Quran Recitation", labelKey: "examinations.subjects.quranRecitation" },
  { value: "Fiqh", labelKey: "examinations.subjects.fiqh" },
];

export const EXAMINATION_FORM_EMPTY: Omit<Exam, "id"> = {
  name: "",
  subject: "",
  totalMarks: 100,
  passingMarks: 50,
  date: "",
  duration: 60,
  classIds: [],
  description: "",
  status: "upcoming",
};
