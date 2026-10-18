import React from "react";
import type { AppTranslationKey } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { FormMessage } from "@/components/ui/form";

interface TranslatedFormMessageProps {
  messageKey?: string;
}

/** Renders a field error when Zod stores an {@link AppTranslationKey} in `message`. */
export function TranslatedFormMessage({
  messageKey,
}: TranslatedFormMessageProps): React.JSX.Element | null {
  const { t } = useTranslation();
  if (!messageKey) return null;
  return <FormMessage>{t(messageKey as AppTranslationKey)}</FormMessage>;
}
