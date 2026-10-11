import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/FormField";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { JOURNAL_TAGS } from "@/lib/data/accountingData";

interface SimpleTransactionTagSelectorProps {
  typeTag?: string;
  tags: string[];
  onChangeTags: (tags: string[]) => void;
  idPrefix?: string;
}

export function SimpleTransactionTagSelector({
  typeTag,
  tags,
  onChangeTags,
  idPrefix,
}: SimpleTransactionTagSelectorProps) {
  const { t } = useTranslation();
  const inputId = `${idPrefix ?? "wizard"}-custom-tag`;
  const [customTagInput, setCustomTagInput] = useState("");
  const customTags = useMemo(
    () => tags.filter((tag) => !JOURNAL_TAGS.includes(tag) && tag !== typeTag),
    [tags, typeTag],
  );

  const toggleTag = (tag: string) => {
    const updated = tags.includes(tag)
      ? tags.filter((existingTag) => existingTag !== tag)
      : [...tags, tag];
    onChangeTags(updated);
  };

  const handleAddCustomTag = () => {
    const trimmed = customTagInput.trim();
    if (!trimmed) return;
    if (!tags.includes(trimmed)) {
      onChangeTags([...tags, trimmed]);
    }
    setCustomTagInput("");
  };

  return (
    <div className="sm:col-span-2 pt-1">
      <Field id={inputId} label={t("accounting.columns.journal.tags")}>
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {typeTag && (
              <Button
                type="button"
                variant={tags.includes(typeTag) ? "default" : "outline"}
                onClick={() => toggleTag(typeTag)}
                aria-pressed={tags.includes(typeTag)}
                className="min-h-11 px-3 py-1 rounded-full text-xs font-semibold"
              >
                {typeTag}
              </Button>
            )}
            {JOURNAL_TAGS.filter((tag) => tag !== typeTag).slice(0, 5).map((tag) => (
              <Button
                key={tag}
                type="button"
                variant={tags.includes(tag) ? "default" : "outline"}
                onClick={() => toggleTag(tag)}
                aria-pressed={tags.includes(tag)}
                className="min-h-11 px-3 py-1 rounded-full text-xs font-semibold"
              >
                {tag}
              </Button>
            ))}
            {customTags.map((tag) => (
              <Badge
                key={tag}
                tone="primary"
                pill
                onRemove={() => toggleTag(tag)}
                removeAriaLabel={`${t("common.delete")} ${tag}`}
                className="min-h-11 px-3 py-1 text-xs font-semibold"
              >
                {tag}
              </Badge>
            ))}
          </div>
          <div className="flex items-center gap-2 pt-1">
            <Input
              id={inputId}
              value={customTagInput}
              onChange={(event) => setCustomTagInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleAddCustomTag();
                }
              }}
              placeholder={t("contacts.form.typeTagPlaceholder")}
              aria-label={t("contacts.form.typeTagPlaceholder")}
              autoComplete="off"
              className="max-w-xs text-xs min-h-11"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAddCustomTag}
              disabled={!customTagInput.trim()}
              className="min-h-11 gap-1 text-xs font-semibold"
            >
              <Plus className="w-3.5 h-3.5" aria-hidden="true" />
              {t("common.add")}
            </Button>
          </div>
        </div>
      </Field>
    </div>
  );
}
