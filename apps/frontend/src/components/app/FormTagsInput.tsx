import React, { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { isImeSafeEnter } from "@shared/ui";

interface TagsInputProps {
  selected?: string[];
  predefined?: string[];
  onChange: (tags: string[]) => void;
  id?: string;
  name?: string;
}

export function TagsInput({
  selected = [],
  predefined = [],
  onChange,
  id,
  name,
}: TagsInputProps): React.JSX.Element {
  const { t } = useTranslation();
  const [inputVal, setInputVal] = useState<string>("");
  const inputRef = useRef<HTMLInputElement>(null);
  const fallbackId = React.useId();
  const resolvedId = id || fallbackId;
  const resolvedName = name || fallbackId;
  const selectedSet = new Set(selected);

  const toggle = (tag: string): void => {
    if (selectedSet.has(tag)) {
      onChange(selected.filter((selectedTag) => selectedTag !== tag));
    } else {
      onChange([...selected, tag]);
    }
  };

  const addCustom = (raw: string): void => {
    const tag = raw.trim();
    if (!tag || selectedSet.has(tag)) return;
    onChange([...selected, tag]);
    setInputVal("");
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>): void => {
    const isEnter = isImeSafeEnter(event);
    const isComma = event.key === ",";
    if ((isEnter || isComma) && inputVal.trim()) {
      event.preventDefault();
      addCustom(inputVal);
    } else if (event.key === "Backspace" && !inputVal && selected.length > 0) {
      onChange(selected.slice(0, -1));
    }
  };

  const remove = (tag: string): void => {
    onChange(selected.filter((selectedTag) => selectedTag !== tag));
  };

  return (
    <div className="space-y-2">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((tag) => (
            <Badge
              key={tag}
              tone="primary"
              className="px-2.5 py-1 text-xs rounded-md font-medium"
              onRemove={() => remove(tag)}
              removeAriaLabel={t("contacts.form.removeTag", { tag })}
            >
              {tag}
            </Badge>
          ))}
        </div>
      )}

      {predefined.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {predefined
            .filter((predefinedTag) => !selectedSet.has(predefinedTag))
            .map((tag) => (
              <Button
                key={tag}
                type="button"
                variant="outline"
                onClick={() => toggle(tag)}
                className="inline-flex items-center justify-center min-h-11 min-w-11 px-3 rounded-md text-xs font-medium border border-border bg-muted/50 text-muted-foreground hover:border-primary/40 hover:bg-primary/5 hover:text-primary transition-all"
              >
                + {tag}
              </Button>
            ))}
        </div>
      )}

      <div className="flex gap-2">
        <Input
          id={resolvedId}
          name={resolvedName}
          ref={inputRef}
          className="flex-1"
          value={inputVal}
          onChange={(event) => setInputVal(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => {
            if (inputVal.trim()) addCustom(inputVal);
          }}
          placeholder={t("contacts.form.typeTagPlaceholder")}
          aria-label={t("contacts.form.typeTagPlaceholder")}
        />
        {inputVal.trim() && (
          <Button
            type="button"
            size="sm"
            onClick={() => addCustom(inputVal)}
            className="px-3 min-h-11 text-xs font-semibold flex-shrink-0"
          >
            {t("common.add")}
          </Button>
        )}
      </div>
    </div>
  );
}
