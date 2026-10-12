import React, { useState } from "react";
import { Plus, Sparkles, Tag } from "lucide-react";
import type { JournalTemplate } from "@mms/shared";
import { JOURNAL_TAGS } from "@/lib/data/accountingData";
import { SectionCard } from "@/components/ui/SectionCard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";
import { getJournalTagLabel } from "./journalEntriesListShared";
import type { DraftForm } from "./journalEntryFormTypes";

interface JournalEntryFormTagsSectionProps {
  t: TranslationFunction;
  form: DraftForm;
  toggleTag: (tag: string) => void;
  /** Configured entry templates; when empty the legacy built-in tags are offered. */
  templates?: readonly JournalTemplate[];
  canSeedTemplates?: boolean;
  seedingTemplates?: boolean;
  onSeedTemplates?: () => void | Promise<void>;
}

export function JournalEntryFormTagsSection({
  t,
  form,
  toggleTag,
  templates = [],
  canSeedTemplates = false,
  seedingTemplates = false,
  onSeedTemplates,
}: JournalEntryFormTagsSectionProps): React.JSX.Element {
  const [customTagInput, setCustomTagInput] = useState("");
  const activeTags = form.tags || [];
  const presetTags =
    templates.length > 0 ? templates.map((template) => template.name) : JOURNAL_TAGS;
  const customTags = activeTags.filter((tag) => !presetTags.includes(tag));

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!activeTags.includes(trimmed)) {
      toggleTag(trimmed);
    }
    setCustomTagInput("");
  };

  return (
    <SectionCard
      accentColor="info"
      icon={Tag}
      title={t("accounting.journal.form.tagsTitle")}
      className="shadow-sm text-start"
    >
      <div className="space-y-3">
        {templates.length > 0 ? (
          <p className="m-0 text-xs text-muted-foreground">{t("accounting.templates.formHint")}</p>
        ) : (
          canSeedTemplates &&
          onSeedTemplates && (
            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 px-3 py-2">
              <p className="m-0 flex-1 text-xs text-foreground/80">
                {t("accounting.templates.empty")}
              </p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={seedingTemplates}
                onClick={() => void onSeedTemplates()}
                className="min-h-11 gap-1.5 text-xs font-semibold"
              >
                <Sparkles className="w-3.5 h-3.5" aria-hidden="true" />{" "}
                {t("accounting.templates.seedAction")}
              </Button>
            </div>
          )
        )}
        <div className="flex flex-wrap items-center gap-1.5">
          {presetTags.map((tag) => (
            <Button
              key={tag}
              type="button"
              variant={activeTags.includes(tag) ? "default" : "outline"}
              onClick={() => toggleTag(tag)}
              aria-pressed={activeTags.includes(tag)}
              className="min-h-11 px-2.5 py-1 rounded-full text-xs font-semibold"
            >
              {getJournalTagLabel(tag, t)}
            </Button>
          ))}
          {customTags.map((tag) => (
            <Badge
              key={tag}
              tone="primary"
              pill
              onRemove={() => toggleTag(tag)}
              removeAriaLabel={t("contacts.form.removeTag", { tag })}
              className="min-h-11 px-3 py-1 text-xs font-semibold"
            >
              {tag}
            </Badge>
          ))}
        </div>

        <div className="flex items-center gap-2 pt-1">
          <Input
            id="journal-custom-tag-input"
            aria-label={t("contacts.form.typeTagPlaceholder")}
            value={customTagInput}
            onChange={(event) => setCustomTagInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                handleAddCustomTag();
              }
            }}
            placeholder={t("contacts.form.typeTagPlaceholder")}
            className="max-w-xs text-xs h-9"
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleAddCustomTag}
            disabled={!customTagInput.trim()}
            className="h-9 gap-1 text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" aria-hidden="true" />
            {t("common.add")}
          </Button>
        </div>
      </div>
    </SectionCard>
  );
}
