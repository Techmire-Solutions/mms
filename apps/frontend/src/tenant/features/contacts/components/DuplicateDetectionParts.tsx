import type React from "react";
import { Check } from "lucide-react";
import type { Contact, ContactPreferences } from "@mms/shared";
import { getDuplicateConfidenceBadgeStyle } from "@mms/shared";
import { useContactConfig } from "@/lib/contexts/ContactConfigContext";
import { useTranslation } from "@/hooks/useTranslation";
import { getDuplicateFieldLabel, getDuplicateFieldValue } from "@/lib/contacts/contactI18n";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ConfidenceBadgeProps {
  score: number;
  prefs: Partial<ContactPreferences>;
}

export function ConfidenceBadge({ score, prefs }: ConfidenceBadgeProps): React.JSX.Element {
  const { t } = useTranslation();
  const { colorClass } = getDuplicateConfidenceBadgeStyle(score, prefs);
  return (
    <Badge pill variant="outline" className={cn("px-2 font-bold", colorClass)}>
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
        "flex-1 min-h-11 h-auto flex flex-col items-stretch justify-start rounded-2xl border-2 p-4 text-start transition-all touch-manipulation shadow-none font-normal",
        selected
          ? "border-primary bg-primary/5 shadow-xs hover:bg-primary/10 text-foreground"
          : "border-border/80 bg-card/40 hover:border-primary/40 hover:bg-card/70 text-foreground",
      )}
    >
      <div className="flex items-center justify-between mb-3 w-full">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          {label}
        </span>
        {selected && <Check className="w-4 h-4 text-primary" />}
      </div>
      <div className="space-y-1.5 w-full">
        {fields.map((field) => (
          <div key={field} className="flex items-start gap-2">
            <span className="text-xs text-muted-foreground w-14 shrink-0">
              {getDuplicateFieldLabel(field, t)}:
            </span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
              {getDuplicateFieldValue(field, contact, t)}
            </span>
          </div>
        ))}
      </div>
    </Button>
  );
}
