/**
 * @file usersTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Users.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface UserTransferEntity {
  name: string;
  email: string;
  role: string;
  status?: string;
  phone?: string;
  twoFactorEnabled?: boolean;
  notes?: string;
}

export const usersTransferSchema: ModuleTransferSchema<UserTransferEntity> =
  createModuleTransferSchema<UserTransferEntity>({
    moduleId: "users",
    entityNounPlural: "users",
    defaultFilename: "users.csv",
    fields: [
      {
        key: "name",
        label: "Full Name",
        aliases: ["Name", "user_name"],
        required: true,
        sample: "Fatima Zahra",
        extract: (u) => u.name || "",
      },
      {
        key: "email",
        label: "Email Address",
        aliases: ["Email", "login_email", "username"],
        required: true,
        sample: "fatima@madrasa.org",
        extract: (u) => u.email || "",
        parse: (raw) => raw.trim().toLowerCase(),
      },
      {
        key: "role",
        label: "Role",
        aliases: ["user_role", "Access Role"],
        required: true,
        sample: "teacher",
        extract: (u) => u.role || "viewer",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["Account Status"],
        sample: "active",
        extract: (u) => u.status || "active",
      },
      {
        key: "phone",
        label: "Phone Number",
        aliases: ["Phone", "mobile"],
        sample: "+923001234567",
        extract: (u) => u.phone || "",
        parse: (raw) => raw.trim().replace(/^'+/, ""),
      },
      {
        key: "twoFactorEnabled",
        label: "2FA Enabled",
        aliases: ["2fa", "two_factor"],
        sample: "No",
        extract: (u) => (u.twoFactorEnabled ? "Yes" : "No"),
        parse: (raw) => {
          const v = raw.trim().toLowerCase();
          return v === "yes" || v === "true" || v === "1";
        },
      },
      {
        key: "notes",
        label: "Notes",
        aliases: ["Remarks"],
        sample: "Primary school branch admin",
        extract: (u) => u.notes || "",
      },
    ],
  });

registerModuleTransferSchema(usersTransferSchema);
