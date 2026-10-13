import { describe, expect, it } from "vitest";
import {
  filterContactExportColumnsForViewer,
  buildContactsExportRows,
  type ContactExportColumn,
  type ContactExportLabels,
} from "../contacts/contactsExportUtils.js";
import type { Contact } from "../contacts/contactTypes.js";

describe("contactsExportUtils", () => {
  const columns: ContactExportColumn[] = [
    { id: "name", label: "Full Name" },
    { id: "phone", label: "Phone Number" },
    { id: "email", label: "Email Address" },
    { id: "whatsapp", label: "Has WhatsApp" },
    { id: "city", label: "City" },
  ];

  const labels: ContactExportLabels = { yes: "Yes", no: "No" };

  const contacts: Contact[] = [
    {
      id: "c-1",
      firstName: "Aisha",
      lastName: "Siddiqui",
      name: "Aisha Siddiqui",
      phones: [{ label: "Mobile", number: "3001234567", countryCode: "+92" }],
      emails: [{ label: "Personal", address: "aisha@example.com" }],
      addresses: [{ label: "Home", city: "Lahore", country: "Pakistan" }],
    },
    {
      id: "c-2",
      firstName: "Bilal",
      lastName: "Hassan",
      name: "Bilal Hassan",
      phones: [{ label: "Home", number: "3007654321", countryCode: "+92" }],
      emails: [],
    },
  ];

  it("filters export columns based on viewer permissions", () => {
    const filtered = filterContactExportColumnsForViewer(columns, null, "admin");
    expect(filtered).toHaveLength(5);
  });

  it("builds CSV header and rows correctly", () => {
    const rows = buildContactsExportRows(contacts, columns, labels);
    expect(rows).toHaveLength(3); // 1 header + 2 data rows

    // Header row
    expect(rows[0]).toEqual(["Full Name", "Phone Number", "Email Address", "Has WhatsApp", "City"]);

    // Aisha row
    expect(rows[1]).toEqual([
      "Aisha Siddiqui",
      "+92 3001234567",
      "aisha@example.com",
      "Yes",
      "Lahore",
    ]);

    // Bilal row
    expect(rows[2]).toEqual(["Bilal Hassan", "+92 3007654321", "", "Yes", ""]);
  });

  it("correctly extracts comprehensive fields from all contact profile and audit tables", () => {
    const extendedColumns: ContactExportColumn[] = [
      { id: "id", label: "ID" },
      { id: "avatar", label: "Avatar" },
      { id: "phone_countryCode", label: "Country Code" },
      { id: "phone_isPrimary", label: "Primary Phone" },
      { id: "email_isVerified", label: "Verified Email" },
      { id: "education_degree", label: "Degree" },
      { id: "education_institution", label: "Institution" },
      { id: "experience_label", label: "Exp Label" },
      { id: "skills_name", label: "Skill" },
      { id: "skills_label", label: "Skill Label" },
      { id: "skills_isCertified", label: "Certified" },
      { id: "relationship_email", label: "Rel Email" },
      { id: "bank_name", label: "Bank" },
      { id: "bank_accountNumber", label: "Account" },
      { id: "activity_type", label: "Activity Type" },
      { id: "attachment_name", label: "Attachment" },
      { id: "createdAt", label: "Created At" },
    ];

    const contactWithAllTables: Contact = {
      id: "c-full",
      name: "Zainab Fatima",
      firstName: "Zainab",
      lastName: "Fatima",
      avatar: "https://example.com/avatar.jpg",
      phones: [{ label: "Mobile", number: "3009999999", countryCode: "+92", isPrimary: true }],
      emails: [{ label: "Work", address: "zainab@example.com", isVerified: true }],
      education: [
        { degree: "Alimiyyah", institution: "Jamiat Al-Kauthar" },
        { degree: "", institution: "Punjab University" },
      ],
      experience: [{ title: "Teacher", organization: "School", label: "Primary Job" }],
      skills: [{ name: "Arabic", label: "Language", isCertified: true }],
      relationshipContacts: [{ name: "Ali", email: "ali@example.com" }],
      bankDetails: [{ bankName: "Meezan Bank", accountNumber: "01010101" }],
      activities: [{ id: "a-1", type: "call", content: "Inquiry call", date: "2026-01-01" }],
      attachments: [
        {
          id: "att-1",
          name: "id_card.pdf",
          type: "application/pdf",
          size: 1024,
          url: "/doc",
          date: "2026-01-01",
        },
      ],
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const rows = buildContactsExportRows([contactWithAllTables], extendedColumns, labels);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toEqual([
      "c-full",
      "https://example.com/avatar.jpg",
      "+92",
      "Yes",
      "Yes",
      "Alimiyyah; ",
      "Jamiat Al-Kauthar; Punjab University",
      "Primary Job",
      "Arabic",
      "Language",
      "Yes",
      "ali@example.com",
      "Meezan Bank",
      "01010101",
      "call",
      "id_card.pdf",
      "2026-01-01T00:00:00.000Z",
    ]);
  });

  it("resolves and merges custom fields and tabs in contact export columns", () => {
    const fieldConfig = {
      version: 1,
      fields: {
        basic: [
          {
            key: "bloodGroup",
            label: "Blood Group",
            type: "text" as const,
            enabled: true,
            order: 8,
            required: false,
          },
        ],
      },
      formTabs: [{ key: "custom_medical", label: "Medical History", enabled: true, order: 10 }],
      enabledTabs: ["basic", "custom_medical"],
      requiredTabs: ["basic"],
    };

    const allColumns = filterContactExportColumnsForViewer([], fieldConfig, "admin");
    const ids = allColumns.map((c) => c.id);
    expect(ids).toContain("bloodGroup");
    expect(ids).toContain("custom_medical");
    expect(ids).toContain("solarDob");
    expect(ids).toContain("lunarDob");
  });

  it("extracts solarDob, lunarDob, and dynamic custom field types", () => {
    const customColumns: ContactExportColumn[] = [
      { id: "solarDob", label: "Solar DOB" },
      { id: "lunarDob", label: "Lunar DOB" },
      { id: "bloodGroup", label: "Blood Group" },
      { id: "isVaccinated", label: "Vaccinated" },
      { id: "allergies", label: "Allergies" },
    ];

    const contact = {
      id: "c-custom",
      dob: "2000-01-01",
      bloodGroup: "B+",
      isVaccinated: true,
      allergies: ["Peanuts", "Pollen"],
    } as unknown as Contact;

    const rows = buildContactsExportRows([contact], customColumns, labels);
    expect(rows[1]).toEqual([
      "2000-01-01",
      expect.stringContaining("1420"), // Hijri conversion for 2000-01-01
      "B+",
      "Yes",
      "Peanuts; Pollen",
    ]);
  });
});
