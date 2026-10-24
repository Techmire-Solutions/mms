import type { QuestionBankQuestion } from "@mms/shared";
import type { EntityDescriptor } from "@/components/common/entityRegistryTypes";
import { questionBankEntityDescriptor } from "@/components/common/entityRegistry";
import { useStaticEntityDescriptor } from "@/components/common/useStaticEntityDescriptor";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * Returns an i18n-resolved EntityDescriptor<QuestionBankQuestion> with all labels
 * resolved through the active locale at call time.
 */
export function useQuestionBankEntityDescriptor(): EntityDescriptor<QuestionBankQuestion> {
  const { t } = useTranslation();
  return useStaticEntityDescriptor(
    questionBankEntityDescriptor,
    (key, fallback) => t(key as Parameters<typeof t>[0]) || fallback,
  );
}
