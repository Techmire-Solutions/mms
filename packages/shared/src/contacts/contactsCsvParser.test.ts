import { describe, expect, it } from "vitest";
import { parseCsvRows } from "../core/csvParserCore.js";
import { parseContactsCsv } from "./contactsCsvParser.js";
import { ALL_CONTACT_FORM_EXPORT_COLUMNS, buildContactsExportRows } from "./contactsExportUtils.js";
import { buildCsvContent } from "../core/csvUtils.js";
import type { Contact } from "./contactEntityTypes.js";

describe("parseCsvRows", () => {
  it("parses unquoted and quoted values with commas and newlines", () => {
    const csv =
      'Name,City,Notes\n"Ali, Reza",Karachi,"Line 1\nLine 2"\nZahra,Lahore,"Hello ""world"""';
    const rows = parseCsvRows(csv);
    expect(rows).toEqual([
      ["Name", "City", "Notes"],
      ["Ali, Reza", "Karachi", "Line 1\nLine 2"],
      ["Zahra", "Lahore", 'Hello "world"'],
    ]);
  });

  it("strips UTF-8 BOM if present", () => {
    const csv = "\uFEFFFirst Name,Last Name\nAli,Hassan";
    const rows = parseCsvRows(csv);
    expect(rows).toEqual([
      ["First Name", "Last Name"],
      ["Ali", "Hassan"],
    ]);
  });
});

describe("parseContactsCsv", () => {
  it("maps form fields across all 10 tabs correctly", () => {
    const csv = [
      "First Name,Last Name,Gender,Date of Birth,CNIC / National ID,Is Syed,Tag,Notes," +
        "Phone Type,Phone Number,Email Type,Email Address,Address Type,Street Address,City,State / Province,Country," +
        "Social Platform,Social URL,Degree / Qualification,Institution,Field of Study,Graduation Year,Grade / Score," +
        "Job Title,Organization,Employment Type,Job Location,Job Start Date,Job End Date,Currently Working Here,Job Description," +
        "Skill Name,Skill Category,Skill Proficiency,Years of Experience,Certified,Certifying Body / Issuer,Skill Notes," +
        "Relationship Contact,Relationship Type,Bank Name,Bank Account Title,Bank Account Number",
      "Fatima,Zahra,Female,1995-05-12,42101-1234567-1,Yes,VIP,Scholar," +
        "Mobile,03001234567,Personal,fatima@example.com,Home,123 Main St,Karachi,Sindh,Pakistan," +
        "LinkedIn,https://linkedin.com/in/fatima,Dars-e-Nizami,Jamia Al-Kawthar,Islamic Law,2018,A+," +
        "Lecturer,Jamia,Full-time,Karachi,2019-01,2023-12,No,Taught jurisprudence," +
        "Fiqh,Islamic Studies,Advanced,5,Yes,Hawza,Certified muallimah," +
        "Ali Zahra,Brother,Meezan Bank,Fatima Zahra,PK00MEZN000123456789",
    ].join("\n");

    const { contacts, errors } = parseContactsCsv(csv);
    expect(errors).toHaveLength(0);
    expect(contacts).toHaveLength(1);

    const c = contacts[0];
    expect(c.firstName).toBe("Fatima");
    expect(c.lastName).toBe("Zahra");
    expect(c.name).toBe("Fatima Zahra");
    expect(c.gender).toBe("Female");
    expect(c.dob).toBe("1995-05-12");
    expect(c.cnic).toBe("42101-1234567-1");
    expect(c.isSyed).toBe(true);
    expect(c.tag).toBe("VIP");
    expect(c.notes).toBe("Scholar");

    // Phones
    expect(c.phones).toEqual([{ label: "Mobile", number: "03001234567", isPrimary: true }]);

    // Emails
    expect(c.emails).toEqual([
      { label: "Personal", address: "fatima@example.com", isPrimary: true },
    ]);

    // Addresses
    expect(c.addresses).toEqual([
      {
        label: "Home",
        line1: "123 Main St",
        city: "Karachi",
        state: "Sindh",
        country: "Pakistan",
        isPrimary: true,
      },
    ]);

    // Socials
    expect(c.socials).toEqual([{ platform: "LinkedIn", url: "https://linkedin.com/in/fatima" }]);

    // Education
    expect(c.education).toEqual([
      {
        institution: "Jamia Al-Kawthar",
        degree: "Dars-e-Nizami",
        fieldOfStudy: "Islamic Law",
        year: "2018",
        grade: "A+",
      },
    ]);

    // Experience
    expect(c.experience).toEqual([
      {
        title: "Lecturer",
        organization: "Jamia",
        employmentType: "Full-time",
        location: "Karachi",
        startDate: "2019-01",
        endDate: "2023-12",
        isCurrent: false,
        description: "Taught jurisprudence",
      },
    ]);

    // Skills
    expect(c.skills).toEqual([
      {
        name: "Fiqh",
        category: "Islamic Studies",
        proficiency: "Advanced",
        yearsOfExperience: "5",
        isCertified: true,
        issuer: "Hawza",
        description: "Certified muallimah",
      },
    ]);

    // Relationships
    expect(c.relationshipContacts).toEqual([
      {
        name: "Ali Zahra",
        relationship: "Brother",
      },
    ]);

    // Bank Details
    expect(c.bankDetails).toEqual([
      {
        bankName: "Meezan Bank",
        accountTitle: "Fatima Zahra",
        accountNumber: "PK00MEZN000123456789",
      },
    ]);
  });

  it("supports multiple semicolon-separated items in array fields", () => {
    const csv = [
      "First Name,Last Name,Phone Type,Phone Number,Email Type,Email Address,Institution,Degree",
      "Hassan,Ali,Mobile; Work,03001111111; 03002222222,Personal; Work,h1@test.com; h2@test.com,Inst A; Inst B,Degree A; Degree B",
    ].join("\n");

    const { contacts } = parseContactsCsv(csv);
    expect(contacts).toHaveLength(1);
    const c = contacts[0];
    expect(c.phones).toEqual([
      { label: "Mobile", number: "03001111111", isPrimary: true },
      { label: "Work", number: "03002222222", isPrimary: false },
    ]);
    expect(c.emails).toEqual([
      { label: "Personal", address: "h1@test.com", isPrimary: true },
      { label: "Work", address: "h2@test.com", isPrimary: false },
    ]);
    expect(c.education).toHaveLength(2);
    expect(c.education?.[0].institution).toBe("Inst A");
    expect(c.education?.[1].institution).toBe("Inst B");
  });

  it("round-trips export -> CSV -> import across all 13 tables and attributes", () => {
    const original: Contact = {
      id: "c-test-1",
      firstName: "Baqir",
      lastName: "Sadr",
      name: "Baqir Sadr",
      gender: "Male",
      dob: "1980-03-01",
      cnic: "35201-9999999-1",
      isSyed: true,
      avatar: "https://example.com/baqir.jpg",
      tag: "Faculty",
      notes: "Head of Department",
      whatsappStatus: "REGISTERED",
      lastCheckedAt: "2026-10-01T12:00:00Z",
      aiSummary: "Leading Islamic scholar and researcher",
      phones: [
        {
          label: "Mobile",
          number: "+923001234567",
          countryCode: "+92",
          isPrimary: true,
          whatsappStatus: "REGISTERED",
        },
      ],
      emails: [{ label: "Work", address: "baqir@madrasa.org", isPrimary: true, isVerified: true }],
      addresses: [
        {
          label: "Office",
          line1: "45 Knowledge Way",
          city: "Najaf",
          state: "Najaf",
          country: "Iraq",
          isPrimary: true,
        },
      ],
      socials: [{ platform: "X", url: "https://x.com/baqir" }],
      education: [
        {
          institution: "Hawza Najaf",
          degree: "Ijtihad",
          fieldOfStudy: "Usul al-Fiqh",
          year: "2005",
          grade: "Mumtaz",
          isCurrentlyEnrolled: false,
          label: "Highest Degree",
        },
      ],
      experience: [
        {
          title: "Professor",
          organization: "Hawza",
          employmentType: "Full-time",
          location: "Najaf",
          startDate: "2006",
          endDate: "",
          isCurrent: true,
          description: "Teaching advanced jurisprudence",
          label: "Academic",
        },
      ],
      skills: [
        {
          name: "Arabic",
          category: "Languages",
          proficiency: "Native",
          yearsOfExperience: "20",
          isCertified: true,
          issuer: "Board",
          description: "Classical and modern standard",
          label: "Primary",
        },
      ],
      relationshipContacts: [
        {
          name: "Ammar Sadr",
          relationship: "Son",
          phone: "+923007654321",
          email: "ammar@test.com",
          gender: "Male",
          contactId: "c-test-2",
          inferred: false,
        },
      ],
      bankDetails: [
        { bankName: "Bank of Baghdad", accountTitle: "Baqir Sadr", accountNumber: "IQ00112233" },
      ],
      activities: [
        {
          id: "act_1",
          type: "note",
          content: "Reviewed curriculum",
          date: "2026-10-05",
          by: "Dean",
        },
      ],
      attachments: [
        {
          id: "att_1",
          name: "cv.pdf",
          type: "application/pdf",
          size: 1048576,
          url: "https://files.org/cv.pdf",
          date: "2026-10-05",
        },
      ],
      createdAt: "2026-01-01T00:00:00Z",
      updatedAt: "2026-10-05T00:00:00Z",
      createdBy: "admin-1",
      updatedBy: "admin-2",
    };

    const labels = { yes: "Yes", no: "No" };
    const rows = buildContactsExportRows([original], [...ALL_CONTACT_FORM_EXPORT_COLUMNS], labels);
    const csvContent = buildCsvContent(rows);

    const { contacts } = parseContactsCsv(csvContent);
    expect(contacts).toHaveLength(1);
    const roundTripped = contacts[0];

    // Core
    expect(roundTripped.id).toBe(original.id);
    expect(roundTripped.firstName).toBe(original.firstName);
    expect(roundTripped.lastName).toBe(original.lastName);
    expect(roundTripped.name).toBe(original.name);
    expect(roundTripped.gender).toBe(original.gender);
    expect(roundTripped.dob).toBe(original.dob);
    expect(roundTripped.cnic).toBe(original.cnic);
    expect(roundTripped.isSyed).toBe(original.isSyed);
    expect(roundTripped.avatar).toBe(original.avatar);
    expect(roundTripped.tag).toBe(original.tag);
    expect(roundTripped.notes).toBe(original.notes);
    expect(roundTripped.whatsappStatus).toBe(original.whatsappStatus);
    expect(roundTripped.lastCheckedAt).toBe(original.lastCheckedAt);
    expect(roundTripped.aiSummary).toBe(original.aiSummary);

    // Phones
    expect(roundTripped.phones?.[0].number).toBe(original.phones?.[0].number);
    expect(roundTripped.phones?.[0].countryCode).toBe(original.phones?.[0].countryCode);
    expect(roundTripped.phones?.[0].isPrimary).toBe(true);
    expect(roundTripped.phones?.[0].whatsappStatus).toBe(original.phones?.[0].whatsappStatus);

    // Emails
    expect(roundTripped.emails?.[0].address).toBe(original.emails?.[0].address);
    expect(roundTripped.emails?.[0].isPrimary).toBe(true);
    expect(roundTripped.emails?.[0].isVerified).toBe(true);

    // Addresses
    expect(roundTripped.addresses?.[0].city).toBe(original.addresses?.[0].city);
    expect(roundTripped.addresses?.[0].country).toBe(original.addresses?.[0].country);
    expect(roundTripped.addresses?.[0].isPrimary).toBe(true);

    // Socials
    expect(roundTripped.socials?.[0].url).toBe(original.socials?.[0].url);

    // Education
    expect(roundTripped.education?.[0].institution).toBe(original.education?.[0].institution);
    expect(roundTripped.education?.[0].degree).toBe(original.education?.[0].degree);
    expect(roundTripped.education?.[0].isCurrentlyEnrolled).toBe(false);
    expect(roundTripped.education?.[0].label).toBe(original.education?.[0].label);

    // Experience
    expect(roundTripped.experience?.[0].title).toBe(original.experience?.[0].title);
    expect(roundTripped.experience?.[0].employmentType).toBe(
      original.experience?.[0].employmentType,
    );
    expect(roundTripped.experience?.[0].isCurrent).toBe(true);
    expect(roundTripped.experience?.[0].description).toBe(original.experience?.[0].description);

    // Skills
    expect(roundTripped.skills?.[0].name).toBe(original.skills?.[0].name);
    expect(roundTripped.skills?.[0].isCertified).toBe(true);
    expect(roundTripped.skills?.[0].issuer).toBe(original.skills?.[0].issuer);

    // Relationships
    expect(roundTripped.relationshipContacts?.[0].name).toBe(
      original.relationshipContacts?.[0].name,
    );
    expect(roundTripped.relationshipContacts?.[0].relationship).toBe(
      original.relationshipContacts?.[0].relationship,
    );
    expect(roundTripped.relationshipContacts?.[0].phone).toBe(
      original.relationshipContacts?.[0].phone,
    );
    expect(roundTripped.relationshipContacts?.[0].contactId).toBe(
      original.relationshipContacts?.[0].contactId,
    );

    // Bank Details
    expect(roundTripped.bankDetails?.[0].accountNumber).toBe(
      original.bankDetails?.[0].accountNumber,
    );

    // Activities & Attachments
    expect(roundTripped.activities?.[0].type).toBe(original.activities?.[0].type);
    expect(roundTripped.activities?.[0].content).toBe(original.activities?.[0].content);
    expect(roundTripped.attachments?.[0].name).toBe(original.attachments?.[0].name);
    expect(roundTripped.attachments?.[0].url).toBe(original.attachments?.[0].url);

    // Audit
    expect(roundTripped.createdAt).toBe(original.createdAt);
    expect(roundTripped.updatedAt).toBe(original.updatedAt);
    expect(roundTripped.createdBy).toBe(original.createdBy);
    expect(roundTripped.updatedBy).toBe(original.updatedBy);
  });

  it("parses CSV with unified Name column and variations of headers", () => {
    const csv = ["Name,Mobile,Mail,City", "Syed Ali,03001234567,ali@example.com,Karachi"].join(
      "\n",
    );

    const { contacts, errors } = parseContactsCsv(csv);
    expect(errors).toHaveLength(0);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].firstName).toBe("Syed");
    expect(contacts[0].lastName).toBe("Ali");
    expect(contacts[0].phones?.[0].number).toBe("03001234567");
    expect(contacts[0].emails?.[0].address).toBe("ali@example.com");
  });

  it("falls back to phone/email if row has no name", () => {
    const csv = ["Phone Number,Email Address", "+923009876543,no-name@example.com"].join("\n");

    const { contacts } = parseContactsCsv(csv);
    expect(contacts).toHaveLength(1);
    expect(contacts[0].firstName).toBe("+923009876543");
  });

  it("correctly maps contacts.columns.* prefixed headers", () => {
    const csv = [
      '"contacts.columns.firstName","contacts.columns.lastName","Gender","Date of Birth","CNIC / National ID","Is Syed","Tag","Notes","contacts.columns.phone_label","contacts.columns.phone_number","contacts.columns.email_label","contacts.columns.email_address","contacts.columns.address_label","contacts.columns.line1","City","State / Province","Country"',
      '"Abid Raza","","Male","","","No","","","Mobile","3132894360","","","Home","R.5 42 /20 F.b Area","Karachi","Sindh","Pakistan"',
      '"Adnan Ul Khizar","Arain","Male","1990-04-04","42401 6801664 1","No","Staff","","Mobile","3442241024","Personal","adnan4428@yahoo.com","Home","House #120","Karachi","Sindh","Pakistan"',
    ].join("\n");

    const { contacts, errors } = parseContactsCsv(csv);
    expect(errors).toHaveLength(0);
    expect(contacts).toHaveLength(2);
    expect(contacts[0].firstName).toBe("Abid Raza");
    expect(contacts[0].gender).toBe("Male");
    expect(contacts[0].phones?.[0]?.number).toBe("3132894360");
    expect(contacts[1].firstName).toBe("Adnan Ul Khizar");
    expect(contacts[1].lastName).toBe("Arain");
    expect(contacts[1].phones?.[0]?.number).toBe("3442241024");
    expect(contacts[1].emails?.[0]?.address).toBe("adnan4428@yahoo.com");
  });
});
