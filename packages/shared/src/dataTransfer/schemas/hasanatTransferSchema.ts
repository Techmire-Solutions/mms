/**
 * @file hasanatTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Hasanat.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface HasanatTransferEntity {
  title: string;
  category: string;
  targetPerson?: string;
  points?: number;
  date?: string;
  description?: string;
  notes?: string;
}

export const hasanatTransferSchema: ModuleTransferSchema<HasanatTransferEntity> =
  createModuleTransferSchema<HasanatTransferEntity>({
    moduleId: "hasanat",
    entityNounPlural: "hasanat deeds",
    defaultFilename: "hasanat.csv",
    fields: [
      {
        key: "title",
        label: "Deed / Activity Title",
        aliases: ["deed", "Activity", "Title"],
        required: true,
        sample: "Community Quran Circle Volunteering",
        extract: (h) => h.title || "",
      },
      {
        key: "category",
        label: "Category",
        aliases: ["type", "Kind"],
        required: true,
        sample: "Volunteering",
        extract: (h) => h.category || "",
      },
      {
        key: "targetPerson",
        label: "Student / Participant",
        aliases: ["student", "Participant", "Name"],
        sample: "Ali ibn Husayn",
        extract: (h) => h.targetPerson || "",
      },
      {
        key: "points",
        label: "Points",
        aliases: ["score", "Reward Points"],
        sample: 25,
        extract: (h) => (h.points != null ? String(h.points) : "0"),
        parse: (raw) => (raw ? Number(raw) : undefined),
      },
      {
        key: "date",
        label: "Date",
        aliases: ["activity_date", "Day"],
        sample: "2024-09-10",
        extract: (h) => h.date || "",
      },
      {
        key: "description",
        label: "Description",
        aliases: ["details", "Summary"],
        sample: "Assisted younger students in recitation practice",
        extract: (h) => h.description || "",
      },
      {
        key: "notes",
        label: "Notes",
        aliases: ["Remarks"],
        sample: "Verified by teacher",
        extract: (h) => h.notes || "",
      },
    ],
  });

registerModuleTransferSchema(hasanatTransferSchema);
