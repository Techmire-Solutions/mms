/**
 * @file questionBankTransferSchema.ts
 * @description Standardized, DRY and symmetric SSOT data transfer schema for Question Bank.
 */

import {
  createModuleTransferSchema,
  registerModuleTransferSchema,
  type ModuleTransferSchema,
} from "../index.js";

export interface QuestionBankTransferEntity {
  title: string;
  category: string;
  difficulty?: string;
  type?: string;
  points?: number;
  explanation?: string;
  source?: string;
  status?: string;
  notes?: string;
}

export const questionBankTransferSchema: ModuleTransferSchema<QuestionBankTransferEntity> =
  createModuleTransferSchema<QuestionBankTransferEntity>({
    moduleId: "questionBank",
    entityNounPlural: "questions",
    defaultFilename: "question-bank.csv",
    fields: [
      {
        key: "title",
        label: "Question Stem / Title",
        aliases: ["question", "Stem", "Question", "title"],
        required: true,
        sample: "What is the significance of the event of Ghadir Khumm?",
        extract: (q) => q.title || "",
      },
      {
        key: "category",
        label: "Subject / Category",
        aliases: ["subject", "Category", "category"],
        required: true,
        sample: "Islamic History",
        extract: (q) => q.category || "",
      },
      {
        key: "difficulty",
        label: "Difficulty Level",
        aliases: ["level", "Difficulty"],
        sample: "intermediate",
        extract: (q) => q.difficulty || "medium",
      },
      {
        key: "type",
        label: "Question Type",
        aliases: ["question_type", "Kind"],
        sample: "open-ended",
        extract: (q) => q.type || "text",
      },
      {
        key: "points",
        label: "Points / Weight",
        aliases: ["marks", "Marks", "points"],
        sample: 5,
        extract: (q) => (q.points != null ? String(q.points) : ""),
        parse: (raw) => (raw ? Number(raw) : undefined),
      },
      {
        key: "explanation",
        label: "Explanation / Key",
        aliases: ["answer_key", "Solution"],
        sample: "Historical appointment described in multiple narrations.",
        extract: (q) => q.explanation || "",
      },
      {
        key: "source",
        label: "Reference Source",
        aliases: ["citation", "Book"],
        sample: "Kitab al-Irshad, Ch. 2",
        extract: (q) => q.source || "",
      },
      {
        key: "status",
        label: "Status",
        aliases: ["Review Status"],
        sample: "approved",
        extract: (q) => q.status || "draft",
      },
      {
        key: "notes",
        label: "Notes",
        aliases: ["Remarks"],
        sample: "Used in Term 1 final exam",
        extract: (q) => q.notes || "",
      },
    ],
  });

registerModuleTransferSchema(questionBankTransferSchema);
