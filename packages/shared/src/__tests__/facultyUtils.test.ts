import { describe, expect, it } from "vitest";
import {
  normalizeStoredFaculty,
  hydrateFacultyFromContact,
  formatFacultyDisplayName,
  getContactQualification,
  getContactSpecialization,
} from "../facultyUtils.js";
import type { FacultyMember } from "../facultyTypes.js";
import type { Contact } from "../contactTypes.js";

describe("facultyUtils", () => {
  describe("formatFacultyDisplayName", () => {
    it("appends employee ID when a name is present", () => {
      expect(formatFacultyDisplayName({ name: "Zaid Khan", employeeId: "EMP-01" })).toBe(
        "Zaid Khan (EMP-01)",
      );
    });

    it("falls back to firstName and lastName when name is empty", () => {
      expect(formatFacultyDisplayName({ firstName: "Umar", lastName: "Farooq" })).toBe(
        "Umar Farooq",
      );
    });

    it("falls back to contact firstName and lastName when top-level names are empty", () => {
      expect(formatFacultyDisplayName({ contact: { firstName: "Ali", lastName: "Hassan" } })).toBe(
        "Ali Hassan",
      );
    });

    it("falls back to employee ID only", () => {
      expect(formatFacultyDisplayName({ employeeId: "EMP-09" })).toBe("Faculty (EMP-09)");
    });

    it("returns an empty string for nullish faculty members", () => {
      expect(formatFacultyDisplayName(null)).toBe("");
      expect(formatFacultyDisplayName(undefined)).toBe("");
    });
  });

  describe("normalizeStoredFaculty", () => {
    it("strips contact-owned display fields from faculty record", () => {
      const rawFaculty = {
        id: "t-1",
        contactId: "c-300",
        name: "Ustad Tariq",
        email: "tariq@madrasa.org",
        phone: "+923005554433",
        specialization: "Hifz",
        status: "active",
      };

      const normalized = normalizeStoredFaculty(rawFaculty);
      expect(normalized.id).toBe("t-1");
      expect(normalized.contactId).toBe("c-300");
      expect(normalized.specialization).toBe("Hifz");
      expect((normalized as Record<string, unknown>).name).toBeUndefined();
      expect((normalized as Record<string, unknown>).email).toBeUndefined();
      expect((normalized as Record<string, unknown>).phone).toBeUndefined();
    });

    it("strips profile fields and clears empty contactId", () => {
      const normalized = normalizeStoredFaculty({
        contactId: "",
        name: "Orphan Name",
        firstName: "Orphan",
        specialization: "Tajweed",
      });
      expect((normalized as Record<string, unknown>).contactId).toBeUndefined();
      expect((normalized as Record<string, unknown>).name).toBeUndefined();
      expect((normalized as Record<string, unknown>).firstName).toBeUndefined();
      expect(normalized.specialization).toBe("Tajweed");
    });

    it("strips a hydrated avatar from the write payload", () => {
      const normalized = normalizeStoredFaculty({
        id: "t-9",
        contactId: "c-300",
        avatar: "https://cdn.example.com/avatar.jpg",
        status: "active",
      });
      expect((normalized as Record<string, unknown>).avatar).toBeUndefined();
    });
  });

  describe("hydrateFacultyFromContact", () => {
    const contacts: Contact[] = [
      {
        id: "c-300",
        firstName: "Tariq",
        lastName: "Mahmood",
        name: "Tariq Mahmood",
        avatar: "https://cdn.example.com/tariq.jpg",
        emails: [{ label: "Work", address: "tariq@madrasa.org" }],
        phones: [{ label: "Mobile", number: "3005554433", countryCode: "+92" }],
      },
    ];

    it("hydrates faculty display fields from linked contact profile", () => {
      const rawFaculty: FacultyMember = {
        id: "t-1",
        contactId: "c-300",
        specialization: "Tajweed",
        status: "active",
      };

      const hydrated = hydrateFacultyFromContact(rawFaculty, contacts);
      expect(hydrated.name).toBe("Tariq Mahmood");
      expect(hydrated.email).toBe("tariq@madrasa.org");
      expect(hydrated.phone).toBe("3005554433");
      expect(hydrated.specialization).toBe("Tajweed");
      expect(hydrated.avatar).toBe("https://cdn.example.com/tariq.jpg");
    });

    it("leaves avatar unset when the linked contact has no avatar", () => {
      const rawFaculty: FacultyMember = {
        id: "t-2",
        contactId: "c-300",
        status: "active",
      };

      const hydrated = hydrateFacultyFromContact(rawFaculty, [
        { id: "c-300", name: "Tariq Mahmood" },
      ]);
      expect(hydrated.avatar).toBeUndefined();
    });

    it("hydrates qualification and specialization from contact education and skills", () => {
      const rawFaculty: FacultyMember = {
        id: "t-3",
        contactId: "c-400",
        status: "active",
      };

      const contactWithEducation: Contact = {
        id: "c-400",
        firstName: "Qasim",
        name: "Maulana Qasim",
        education: [
          {
            degree: "Shahadat-ul-Aalamiyyah",
            fieldOfStudy: "Hadith Studies",
            institution: "Darul Uloom",
          },
          {
            degree: "M.A. Islamic Studies",
            fieldOfStudy: "Islamic Jurisprudence",
            institution: "Karachi University",
          },
        ],
        skills: [{ name: "Arabic Grammar" }, { name: "Fiqh" }],
      };

      const hydrated = hydrateFacultyFromContact(rawFaculty, [contactWithEducation]);
      expect(hydrated.qualification).toBe("Shahadat-ul-Aalamiyyah, M.A. Islamic Studies");
      expect(hydrated.specialization).toBe("Hadith Studies, Islamic Jurisprudence");
    });

    it("falls back to contact skills for specialization when education fieldOfStudy is empty", () => {
      const rawFaculty: FacultyMember = {
        id: "t-4",
        contactId: "c-500",
        status: "active",
      };

      const contactWithSkills: Contact = {
        id: "c-500",
        firstName: "Bilal",
        name: "Qari Bilal",
        education: [{ degree: "Hifz Certificate", institution: "Madrasa" }],
        skills: [{ name: "Tajweed" }, { name: "Qirat Sab’ah" }],
      };

      const hydrated = hydrateFacultyFromContact(rawFaculty, [contactWithSkills]);
      expect(hydrated.qualification).toBe("Hifz Certificate");
      expect(hydrated.specialization).toBe("Tajweed, Qirat Sab’ah");
    });
  });

  describe("getContactQualification and getContactSpecialization", () => {
    it("returns empty string when contact is nullish or has no records", () => {
      expect(getContactQualification(null)).toBe("");
      expect(getContactSpecialization(undefined)).toBe("");
      expect(getContactQualification({ id: "c-1" })).toBe("");
      expect(getContactSpecialization({ id: "c-1" })).toBe("");
    });

    it("resolves scalar qualification and specialization when arrays are absent", () => {
      const contact = {
        id: "c-2",
        qualification: "B.Ed",
        specialization: "Mathematics",
      };
      expect(getContactQualification(contact)).toBe("B.Ed");
      expect(getContactSpecialization(contact)).toBe("Mathematics");
    });
  });
});
