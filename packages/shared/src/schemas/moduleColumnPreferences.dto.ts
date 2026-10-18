import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

export const moduleColumnPreferenceSchema = z
  .object({
    key: z.string().min(1).max(64),
    enabled: z.boolean(),
    order: z.number().int().min(0),
    width: z.number().int().min(80).max(640).optional(),
  })
  .strict();

const moduleColumnPreferencesBodyBaseSchema = z
  .object({
    preferences: z.array(moduleColumnPreferenceSchema).max(64),
  })
  .strict();

export const moduleColumnPreferencesBodySchema = z.preprocess((raw) => {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
  return deepSanitizeStrings(raw);
}, moduleColumnPreferencesBodyBaseSchema);

export const moduleColumnPreferencesResponseSchema = z.object({
  success: z.boolean().optional(),
  preferences: z.array(moduleColumnPreferenceSchema).optional(),
  prefs: z.array(moduleColumnPreferenceSchema).optional(),
});

export type ModuleColumnPreferencesResponse = z.infer<typeof moduleColumnPreferencesResponseSchema>;
