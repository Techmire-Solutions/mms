import { z } from "zod";

export const userUiStateSchema = z.record(z.string(), z.unknown());

export const patchUserUiStateBodySchema = z
  .object({
    state: z
      .record(z.string(), z.unknown())
      .describe("Partial or full UI state to merge into the user's preferences."),
  })
  .strict();

export type UserUiState = z.infer<typeof userUiStateSchema>;
export type PatchUserUiStateBody = z.infer<typeof patchUserUiStateBodySchema>;
