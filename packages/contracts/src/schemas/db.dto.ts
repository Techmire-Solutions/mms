import { z } from "zod";
import { deepSanitizeStrings } from "./sanitize.js";

const collectionItemSchema = z.union([z.string(), z.record(z.string(), z.unknown())]);

export const collectionSaveBodySchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return raw;
    return deepSanitizeStrings(raw);
  },
  z.union([
    z.array(collectionItemSchema),
    z.object({ data: z.array(collectionItemSchema) }).strict(),
  ]),
);
