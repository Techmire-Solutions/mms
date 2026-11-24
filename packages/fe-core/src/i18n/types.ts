import type { AppTranslationKey, TranslationArgs } from "@mms/contracts";

/** Translation function signature shared by the app provider and fe-core helpers. */
export type TranslationFunction = <K extends AppTranslationKey>(
  key: K,
  ...args: TranslationArgs<K>
) => string;
