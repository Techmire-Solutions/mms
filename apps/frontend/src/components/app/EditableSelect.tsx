import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OptionSelectPopover } from "@/components/ui/OptionSelectPopover";
import { useTranslation } from "@/hooks/useTranslation";
import { FORM_INPUT_COMPACT } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

interface EditableSelectProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  /** When omitted, options are read-only (no add/remove). */
  onUpdateOptions?: (options: string[]) => void;
  /**
   * Custom add path (e.g. relationship pairs). Return the label to select on
   * success, or null to keep the popover open (caller handles toasts).
   */
  onCommitAdd?: (raw: string) => string | null | Promise<string | null>;
  /** Optional hint above the add row. */
  addHint?: string;
  /** Overrides the default add-input placeholder. */
  addPlaceholder?: string;
  placeholder?: string;
  className?: string;
  id?: string;
  name?: string;
}

const INPUT_CLASS = cn("h-auto min-w-0 flex-1", FORM_INPUT_COMPACT);

export function EditableSelect({
  options,
  value,
  onChange,
  onUpdateOptions,
  onCommitAdd,
  addHint,
  addPlaceholder,
  placeholder,
  className = "w-28",
  id,
  name,
}: EditableSelectProps): React.JSX.Element {
  const { t } = useTranslation();
  const [customValue, setCustomValue] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const customInputId = React.useId();
  const canAdd = Boolean(onUpdateOptions || onCommitAdd);
  const addInputLabel = addPlaceholder ?? t("contacts.form.addNewTypePlaceholder");

  const handleAdd = async (close: () => void): Promise<void> => {
    if (!canAdd || isAdding) return;
    const text = customValue.trim();
    if (!text) return;

    if (onCommitAdd) {
      setIsAdding(true);
      try {
        const selected = await onCommitAdd(text);
        if (selected == null) return;
        onChange(selected);
        setCustomValue("");
        close();
      } finally {
        setIsAdding(false);
      }
      return;
    }

    if (!onUpdateOptions) return;
    const existing = options.find((opt) => opt.trim().toLowerCase() === text.toLowerCase());
    if (existing) {
      onChange(existing);
    } else {
      onUpdateOptions([...options, text]);
      onChange(text);
    }
    setCustomValue("");
    close();
  };

  return (
    <OptionSelectPopover
      options={options}
      value={value}
      onChange={onChange}
      onUpdateOptions={onUpdateOptions}
      placeholder={placeholder}
      className={className}
      id={id}
      name={name}
      onOpenChange={(open) => {
        if (!open) setCustomValue("");
      }}
      footer={
        !canAdd
          ? undefined
          : ({ close }) => (
              <div className="p-2 space-y-2 bg-muted/20 flex-shrink-0">
                {addHint ? (
                  <p className="px-0.5 text-3xs leading-snug text-muted-foreground">{addHint}</p>
                ) : null}
                <div className="flex gap-1.5">
                  <Input
                    id={customInputId}
                    name={customInputId}
                    type="text"
                    value={customValue}
                    onChange={(event) => setCustomValue(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        event.stopPropagation();
                        void handleAdd(close);
                      }
                    }}
                    placeholder={addInputLabel}
                    aria-label={addInputLabel}
                    disabled={isAdding}
                    className={INPUT_CLASS}
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      void handleAdd(close);
                    }}
                    disabled={isAdding}
                    className="px-2.5 text-xs font-semibold rounded-lg flex-shrink-0"
                  >
                    {t("common.add")}
                  </Button>
                </div>
              </div>
            )
      }
    />
  );
}
