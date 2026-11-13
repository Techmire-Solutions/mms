import { z } from "zod";
import {
  questionAttachmentSchema,
  questionBankQuestionRecordSchema,
  questionBankTestRecordSchema,
} from "../examinations/questionBankModuleManifest.js";
import { QUESTION_STATUSES } from "../examinations/questionLifecycle.js";
import { blueprintDeficitSchema, paperBlueprintSchema } from "../examinations/paperBlueprint.js";
import {
  questionAttachmentParamsSchema,
  questionIdParamsSchema,
} from "../examinations/questionBankListQuery.js";

/**
 * Question Bank lifecycle/authoring action routes.
 *
 * Extracted from `questionBank.contract.ts` so the main contract stays inside the 300-line ceiling
 * and the action surface (status, duplicate, media, assembly) is reviewable on its own. Paths are
 * unchanged; the main contract spreads this object into `c.router({...})`.
 */

const ok = z.unknown();

export const questionDomainResponseStatuses = {
  400: ok,
  403: ok,
  404: ok,
  409: ok,
  422: ok,
  500: ok,
} as const;

export const questionBankActionRoutes = {
  setQuestionStatus: {
    method: "POST",
    path: "/api/question-bank/questions/:id/status",
    pathParams: questionIdParamsSchema,
    body: z
      .object({
        status: z.enum(QUESTION_STATUSES),
        reason: z.string().max(500).optional(),
      })
      .strict(),
    responses: {
      200: z.object({ question: questionBankQuestionRecordSchema }),
      ...questionDomainResponseStatuses,
    },
    summary: "Move a question through its authoring lifecycle",
  },
  duplicateQuestion: {
    method: "POST",
    path: "/api/question-bank/questions/:id/duplicate",
    pathParams: questionIdParamsSchema,
    body: z
      .object({ id: z.string().min(1).max(128).optional() })
      .strict()
      .optional(),
    responses: {
      200: z.object({ question: questionBankQuestionRecordSchema }),
      ...questionDomainResponseStatuses,
    },
    summary: "Clone a question as a new draft revision",
  },
  checkQuestionDuplicates: {
    method: "POST",
    path: "/api/question-bank/questions/check-duplicates",
    body: z
      .object({
        text: z.string().min(1).max(4000),
        excludeId: z.string().max(128).optional(),
        limit: z.number().int().min(1).max(25).optional(),
      })
      .strict(),
    responses: {
      200: z.object({
        matches: z.array(
          z.object({
            id: z.string(),
            text: z.string(),
            difficulty: z.string(),
            categoryIds: z.array(z.string()),
            score: z.number(),
          }),
        ),
      }),
      400: ok,
      403: ok,
      500: ok,
    },
    summary: "Find near-duplicate questions for an authored stem",
  },
  addQuestionAttachment: {
    method: "POST",
    path: "/api/question-bank/questions/:id/attachments",
    pathParams: questionIdParamsSchema,
    body: z
      .object({
        kind: z.enum(["stem", "option"]),
        optionIndex: z.number().int().nonnegative().nullable().optional(),
        url: z.string().min(1).max(2048),
        name: z.string().min(1).max(255),
        mime: z.string().min(1).max(120),
        size: z.number().int().nonnegative(),
      })
      .strict(),
    responses: {
      200: z.object({ attachment: questionAttachmentSchema }),
      ...questionDomainResponseStatuses,
    },
    summary: "Attach an image or audio clip to a question stem or option",
  },
  removeQuestionAttachment: {
    method: "DELETE",
    path: "/api/question-bank/questions/:id/attachments/:attachmentId",
    pathParams: questionAttachmentParamsSchema,
    body: ok,
    responses: {
      200: z.object({ success: z.literal(true) }),
      ...questionDomainResponseStatuses,
    },
    summary: "Detach question media and clean up an unreferenced file",
  },
  assemblePaper: {
    method: "POST",
    path: "/api/question-bank/tests/:id/assemble",
    pathParams: questionIdParamsSchema,
    body: paperBlueprintSchema,
    responses: {
      200: z.object({
        test: questionBankTestRecordSchema.nullable(),
        seedUsed: z.string(),
        totalMarks: z.number(),
        selectedCount: z.number(),
        deficits: z.array(blueprintDeficitSchema),
      }),
      ...questionDomainResponseStatuses,
    },
    summary: "Assemble a paper from a deterministic blueprint",
  },
  setTestPublished: {
    method: "POST",
    path: "/api/question-bank/tests/:id/publish",
    pathParams: questionIdParamsSchema,
    body: z.object({ published: z.boolean() }).strict(),
    responses: {
      200: z.object({ test: questionBankTestRecordSchema }),
      ...questionDomainResponseStatuses,
    },
    summary: "Publish (freeze) or unpublish an exam paper",
  },
} as const;
