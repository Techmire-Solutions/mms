import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { LLM_PROVIDER_KEYS } from "../llmSettingsTypes.js";

const c = initContract();
const errorResponse = z.unknown();

export const aiModelsBodySchema = z
  .object({
    provider: z.enum(LLM_PROVIDER_KEYS),
    apiKey: z.string().optional(),
    configId: z.string().optional(),
    baseUrl: z.string().optional(),
  })
  .strict();

export const aiChatMessageSchema = z
  .object({
    role: z.enum(["user", "assistant", "system"]),
    content: z.string(),
  })
  .strict();

export const aiCustomConfigSchema = z
  .object({
    id: z.string(),
    name: z.string(),
    provider: z.enum(LLM_PROVIDER_KEYS),
    apiKey: z.string(),
    model: z.string(),
    baseUrl: z.string().optional(),
    isDefaultText: z.boolean(),
    temperature: z.number().optional(),
    maxTokens: z.number().optional(),
    topP: z.number().optional(),
  })
  .strict();

export const aiTestBodySchema = z
  .object({
    prompt: z.string().optional(),
    systemInstruction: z.string().optional(),
    configId: z.string().optional(),
    customConfig: aiCustomConfigSchema.optional(),
    messages: z.array(aiChatMessageSchema).optional(),
  })
  .strict();

export const aiModelsResponseSchema = z.object({
  models: z.array(z.string()),
});

export const aiTestMetricsSchema = z.object({
  timeMs: z.number(),
  wordsPerSec: z.string(),
  model: z.string(),
  provider: z.string(),
  tokenUsage: z
    .object({
      promptTokens: z.number().optional(),
      completionTokens: z.number().optional(),
      totalTokens: z.number().optional(),
    })
    .optional(),
});

export const aiTestResultResponseSchema = z.object({
  configId: z.string().optional(),
  success: z.boolean(),
  response: z.string().optional(),
  message: z.string().optional(),
  metrics: aiTestMetricsSchema.optional(),
});

export type AiModelsBody = z.infer<typeof aiModelsBodySchema>;
export type AiChatMessage = z.infer<typeof aiChatMessageSchema>;
export type AiCustomConfig = z.infer<typeof aiCustomConfigSchema>;
export type AiTestBody = z.infer<typeof aiTestBodySchema>;
export type AiModelsResponse = z.infer<typeof aiModelsResponseSchema>;
export type AiTestResultResponse = z.infer<typeof aiTestResultResponseSchema>;

export const aiContract = c.router({
  models: {
    method: "POST",
    path: "/api/ai/models",
    body: aiModelsBodySchema,
    responses: {
      200: aiModelsResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Retrieve available models for an AI provider",
  },
  test: {
    method: "POST",
    path: "/api/ai/test",
    body: aiTestBodySchema,
    responses: {
      200: aiTestResultResponseSchema,
      400: errorResponse,
      403: errorResponse,
      500: errorResponse,
    },
    summary: "Test AI prompt completion and model connectivity",
  },
});
