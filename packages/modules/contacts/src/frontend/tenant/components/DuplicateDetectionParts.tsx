import type React from "react";
import { Check } from "lucide-react";
import type { Contact, ContactPreferences } from "@mms/contracts";
import { getDuplicateConfidenceBadgeStyle } from "@mms/contracts";
import { useContactConfig } from "@mms/mod-contacts/frontend/tenant/components/ContactConfigContext";
import { useTranslation } from "@mms/fe-core/i18n";
import { getDuplicateFieldLabel, getDuplicateFieldValue } from "@mms/fe-core/lib/contactI18n";
import { cn } from "@mms/ui";
import { Badge } from "@mms/ui";
import { Button } from "@mms/ui";
import { BiDiText } from "@mms/ui/app/BiDiText";

export interface ConfidenceBadgeProps {
  score: number;
  prefs: Partial<ContactPreferences>;
}

const CONFIDENCE_TIER_LABEL_KEY = {
  high: "contacts.duplicates.confidenceHigh",
  medium: "contacts.duplicates.confidenceMedium",
  low: "contacts.duplicates.confidenceLow",
} as const;

export function ConfidenceBadge({ score, prefs }: ConfidenceBadgeProps): React.JSX.Element {
  const { t } = useTranslation();
  const { colorClass, labelTier } = getDuplicateConfidenceBadgeStyle(score, prefs);
  return (
    <Badge pill variant="outline" className={cn("px-2 font-bold", colorClass)}>
      <span className="sr-only">{t(CONFIDENCE_TIER_LABEL_KEY[labelTier])}: </span>
      {score}
      {t("contacts.duplicates.matchSuffix")}
    </Badge>
  );
}

export interface DuplicateContactCardProps {
  contact: Contact;
  selected: boolean;
  onSelect: () => void;
  label: string;
}

export function DuplicateContactCard({
  contact,
  selected,
  onSelect,
  label,
}: DuplicateContactCardProps): React.JSX.Element {
  const { prefs } = useContactConfig();
  const { t } = useTranslation();
  const fields = prefs.duplicateDetectionFields || [];

  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      onClick={onSelect}
      className={cn(
        "w-full sm:flex-1 min-w-0 min-h-11 h-auto whitespace-normal rounded-2xl border-2 p-4 text-start transition-all touch-manipulation shadow-none font-normal",
        selected
          ? "border-primary bg-primary/5 shadow-xs hover:bg-primary/10 text-foreground"
          : "border-border/80 bg-card/40 hover:border-primary/40 hover:bg-card/70 text-foreground",
      )}
    >
      <div className="flex w-full min-w-0 flex-col items-stretch justify-start">
        <div className="flex items-center justify-between mb-3 w-full min-w-0 gap-2">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </span>
          {selected && <Check className="w-4 h-4 shrink-0 text-primary" />}
        </div>
        <div className="space-y-1.5 w-full min-w-0">
          {fields.map((field) => (
            <div key={field} className="flex min-w-0 items-start gap-2">
              <span className="text-xs text-muted-foreground w-14 shrink-0">
                {getDuplicateFieldLabel(field, t)}:
              </span>
              <BiDiText className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
                {getDuplicateFieldValue(field, contact, t)}
              </BiDiText>
            </div>
          ))}
        </div>
      </div>
    </Button>
  );
}
