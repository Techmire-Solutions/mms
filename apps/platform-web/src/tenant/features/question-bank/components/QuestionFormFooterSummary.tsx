import { type AppTranslationKey } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { FormFooterEntityChip, FormFooterErrorChip } from "@mms/ui/app/FormFooterChip";
import { Badge } from "@mms/ui";

import type { QuestionFormDraft } from "../lib/questionFormTypes";

interface QuestionFormFooterSummaryProps {
  questionDraft: QuestionFormDraft;
}

export function QuestionFormFooterSummary({
  questionDraft,
}: QuestionFormFooterSummaryProps): React.JSX.Element {
  const { t } = useTranslation();

  if (!questionDraft.text) {
    return <FormFooterErrorChip>{t("questionBank.validation.textRequired")}</FormFooterErrorChip>;
  }

  return (
    <div className="flex flex-wrap items-center gap-2.5 text-xs">
      <FormFooterEntityChip className="truncate max-w-cell-trunc">
        {questionDraft.text}
      </FormFooterEntityChip>
      <div className="flex items-center gap-1.5">
        <Badge as="span" tone="primary" size="sm" className="capitalize">
          {t(`questionBank.type.${questionDraft.type}` as AppTranslationKey)}
        </Badge>
        <Badge as="span" size="sm" tone="info" className="capitalize">
          {t(`questionBank.difficulty.${questionDraft.difficulty}` as AppTranslationKey)}
        </Badge>
      </div>
    </div>
  );
}
