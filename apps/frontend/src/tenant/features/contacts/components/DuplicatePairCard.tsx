import type React from "react";
import { GitMerge, X } from "lucide-react";
import type { ContactPreferences } from "@mms/shared";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import type { DuplicatePair } from "@/tenant/features/contacts/lib/duplicateDetectionTypes";
import {
  ConfidenceBadge,
  DuplicateContactCard,
} from "@/tenant/features/contacts/components/DuplicateDetectionParts";

export interface DuplicatePairCardProps {
  pair: DuplicatePair;
  prefs: Partial<ContactPreferences>;
  selectedKeepIndex: number;
  canWrite: boolean;
  onMerge: () => void;
  onDismiss: () => void;
  onSelectKeep: (contactIndex: number) => void;
  t: TranslationFunction;
}

export function DuplicatePairCard({
  pair,
  prefs,
  selectedKeepIndex,
  canWrite,
  onMerge,
  onDismiss,
  onSelectKeep,
  t,
}: DuplicatePairCardProps): React.JSX.Element {
  return (
    <Card accentColor="none" className="overflow-hidden bg-muted/10">
      <CardHeader className="flex flex-col gap-2 border-b border-border bg-muted/30 p-0 px-4 py-3 sm:flex-row sm:items-center sm:justify-between space-y-0">
        <div className="flex min-w-0 items-center gap-2.5">
          <ConfidenceBadge score={pair.confidence} prefs={prefs} />
          <span className="min-w-0 truncate text-sm text-muted-foreground">{pair.reason}</span>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          {canWrite && (
            <Button
              type="button"
              onClick={onMerge}
              className="flex min-h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold"
            >
              <GitMerge className="w-3.5 h-3.5" />
              <span>{t("contacts.duplicates.merge")}</span>
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            onClick={onDismiss}
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-transparent p-0 text-muted-foreground transition-colors hover:border-border hover:bg-muted hover:text-foreground"
            title={t("contacts.duplicates.dismiss")}
            aria-label={t("contacts.duplicates.dismiss")}
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4">
        <p className="mb-3 text-xs font-medium text-muted-foreground">
          {t("contacts.duplicates.selectKeep")}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row">
          {pair.contacts.map((contact, contactIndex) => (
            <DuplicateContactCard
              key={contact.id}
              contact={contact}
              label={
                contactIndex === 0
                  ? t("contacts.duplicates.contactA")
                  : t("contacts.duplicates.contactB")
              }
              selected={selectedKeepIndex === contactIndex}
              onSelect={() => onSelectKeep(contactIndex)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
