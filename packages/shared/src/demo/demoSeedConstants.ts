export const DEMO_FACULTY_COUNT = 30;
export const DEMO_STUDENT_COUNT = 100;
export const DEMO_STUDENT_CONTACT_ID_START = 1001;
export const DEMO_PARENT_CONTACT_ID_START = 2001;

export const DEMO_FACULTY_DATE = "2024-01-01";
export const DEMO_STUDENT_DATE = "2025-01-01";

export const DEMO_CITIES = [
  "Karachi",
  "Lahore",
  "Islamabad",
  "Peshawar",
  "Faisalabad",
  "Multan",
  "Quetta",
] as const;

export const DEMO_MALE_FIRST = [
  "Abdullah",
  "Usman",
  "Ahmed",
  "Hassan",
  "Omar",
  "Yusuf",
  "Ibrahim",
  "Hamza",
  "Bilal",
  "Zaid",
  "Khalid",
  "Rashid",
  "Tariq",
  "Imran",
  "Farhan",
  "Saad",
  "Ali",
  "Hussain",
  "Shakir",
  "Faisal",
] as const;

export const DEMO_FEMALE_FIRST = [
  "Fatima",
  "Ayesha",
  "Mariam",
  "Sawdah",
  "Salma",
  "Hira",
  "Zainab",
  "Khadija",
  "Amina",
  "Sana",
  "Rabia",
  "Nadia",
  "Saima",
  "Hina",
  "Laiba",
  "Mahnoor",
  "Alisha",
  "Bushra",
  "Samina",
  "Farah",
] as const;

export const DEMO_LAST_NAMES = [
  "Rizvi",
  "Hussain",
  "Khan",
  "Lodhi",
  "Siddiqui",
  "Malik",
  "Qureshi",
  "Sheikh",
  "Ansari",
  "Hashmi",
  "Chaudhry",
  "Butt",
  "Mirza",
  "Gilani",
  "Jafri",
  "Naqvi",
  "Zaidi",
  "Abbasi",
  "Memon",
  "Baloch",
] as const;

export const DEMO_FACULTY_MALE_TITLES = ["Sheikh", "Qari", "Ustadh"] as const;
export const DEMO_FACULTY_FEMALE_TITLES = ["Ustadha"] as const;

export const DEMO_QUALIFICATIONS = [
  "Ijazah in Hifz",
  "BA Islamic Studies",
  "MA Islamic Studies",
  "Qiraat certification",
  "Dars-e-Nizami",
  "Tajweed certification",
] as const;

export function demoPad(value: number, digits: number): string {
  return String(value).padStart(digits, "0");
}

export function demoSlug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

export function demoPick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

export function demoPhoneSuffix(seed: number): string {
  return demoPad(1000000 + seed * 7919, 7);
}

export function demoFacultyDob(index: number): string {
  const year = 1975 + (index % 20);
  const month = ((index * 3) % 12) + 1;
  const day = ((index * 5) % 27) + 1;
  return `${year}-${demoPad(month, 2)}-${demoPad(day, 2)}`;
}

export function demoStudentDob(index: number): string {
  const year = 2008 + (index % 13);
  const month = (index % 12) + 1;
  const day = (index % 27) + 1;
  return `${year}-${demoPad(month, 2)}-${demoPad(day, 2)}`;
}

export function demoJoinDate(index: number): string {
  const year = 2015 + (index % 10);
  const month = ((index * 2) % 12) + 1;
  const day = ((index * 4) % 27) + 1;
  return `${year}-${demoPad(month, 2)}-${demoPad(day, 2)}`;
}

export function demoRegisteredDate(index: number): string {
  const year = 2024 + (index % 2);
  const month = ((index * 2) % 12) + 1;
  const day = ((index * 3) % 27) + 1;
  return `${year}-${demoPad(month, 2)}-${demoPad(day, 2)}`;
}
