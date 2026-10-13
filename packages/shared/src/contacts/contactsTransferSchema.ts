/**
 * @file contactsTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Contacts.
 *
 * Enforces:
 * 1. Field Whitelist: Only human-readable form fields are exported/imported.
 *    Internal metadata (id, createdAt, updatedAt, createdBy, tenantId) is excluded.
 * 2. Bidirectional Sync: Exported headers match import headers exactly.
 * 3. SSOT: Consolidates columns, labels, samples, extractors, and parsers in one place.
 */

import type { Contact } from "./contactEntityTypes.js";
import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../dataTransfer/index.js";

export const contactsTransferSchema: ModuleTransferSchema<Contact> =
  createModuleTransferSchema<Contact>({
    moduleId: "contacts",
    entityNounPlural: "contacts",
    defaultFilename: "contacts.csv",
    fields: [
      {
        key: "name",
        label: "Full Name",
        aliases: ["Name", "full_name", "Contact Name", "contactname"],
        required: true,
        sample: "Zayd ibn Ali",
        extract: (c) => c.name || [c.firstName, c.lastName].filter(Boolean).join(" ") || "",
      },
      {
        key: "firstName",
        label: "First Name",
        aliases: ["first_name", "First", "given_name"],
        sample: "Zayd",
        extract: (c) => c.firstName || "",
      },
      {
        key: "lastName",
        label: "Last Name",
        aliases: ["last_name", "Last", "surname"],
        sample: "ibn Ali",
        extract: (c) => c.lastName || "",
      },
      {
        key: "gender",
        label: "Gender",
        aliases: ["Sex"],
        sample: "male",
        extract: (c) => c.gender || "",
      },
      {
        key: "dob",
        label: "Date of Birth",
        aliases: ["dob", "date_of_birth", "Birth Date", "birthday"],
        sample: "1990-05-15",
        extract: (c) => c.dob || "",
      },
      {
        key: "cnic",
        label: "National ID",
        aliases: ["CNIC", "cnic", "id_number", "national_id"],
        sample: "42101-1234567-1",
        extract: (c) => c.cnic || "",
      },
      {
        key: "isSyed",
        label: "Is Syed",
        aliases: ["syed", "is_syed"],
        sample: "No",
        extract: (c) => (c.isSyed ? "Yes" : "No"),
        parse: (raw) => {
          const v = raw.trim().toLowerCase();
          return v === "yes" || v === "true" || v === "1";
        },
      },
      {
        key: "phone",
        label: "Phone Number",
        aliases: ["phone_number", "Mobile", "cell", "Phone"],
        sample: "+923001234567",
        extract: (c) => c.phones?.[0]?.number ?? "",
        parse: (raw) => raw.trim().replace(/^'+/, ""),
      },
      {
        key: "email",
        label: "Email Address",
        aliases: ["email_address", "Email", "Mail"],
        sample: "zayd@example.com",
        extract: (c) => c.emails?.[0]?.address ?? "",
        parse: (raw) => raw.trim().toLowerCase(),
      },
      {
        key: "line1",
        label: "Street Address",
        aliases: ["address", "address_line1", "Street"],
        sample: "House 14, Street 5, Block B",
        extract: (c) => c.addresses?.[0]?.line1 ?? "",
      },
      {
        key: "city",
        label: "City",
        aliases: ["Town"],
        sample: "Karachi",
        extract: (c) => c.addresses?.[0]?.city ?? "",
      },
      {
        key: "state",
        label: "State / Province",
        aliases: ["Province", "Region"],
        sample: "Sindh",
        extract: (c) => c.addresses?.[0]?.state ?? "",
      },
      {
        key: "country",
        label: "Country",
        aliases: ["Nation"],
        sample: "Pakistan",
        extract: (c) => c.addresses?.[0]?.country ?? "",
      },
      {
        key: "tag",
        label: "Tag",
        aliases: ["tags", "Category"],
        sample: "Scholar",
        extract: (c) => c.tag || (Array.isArray(c.tags) ? c.tags.join("; ") : ""),
      },
      {
        key: "notes",
        label: "Notes",
        aliases: ["note", "Remarks", "Comments"],
        sample: "Visiting lecturer",
        extract: (c) => c.notes ?? "",
      },
    ],
  });

registerModuleTransferSchema(contactsTransferSchema);
