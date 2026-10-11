import React from "react";
import { normalizeBrandingHex } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { WORK_SURFACE } from "@/components/ui/formStyles";
import { cn } from "@/lib/utils";

export interface BrandColorFieldProps {
  id: string;
  label: string;
  description: string;
  value: string;
  onChange: (hex: string) => void;
}

export function BrandColorField({
  id,
  label,
  description,
  value,
  onChange,
}: BrandColorFieldProps): React.JSX.Element {
  const { t } = useTranslation();
  const [hexDraft, setHexDraft] = React.useState(value);

  React.useEffect(() => {
    setHexDraft(value);
  }, [value]);

  const isValidHex = /^#([0-9a-fA-F]{3}){1,2}$/.test(
    hexDraft.startsWith("#") ? hexDraft : `#${hexDraft}`,
  );

  const commitHex = (): void => {
    const prefixed = hexDraft.trim().startsWith("#") ? hexDraft.trim() : `#${hexDraft.trim()}`;
    const normalized = normalizeBrandingHex(prefixed, value);
    if (normalized !== value || hexDraft.trim()) {
      React.startTransition(() => {
        onChange(normalized);
      });
      setHexDraft(normalized);
      return;
    }
    setHexDraft(value);
  };

  return (
    <div className={`${WORK_SURFACE} space-y-2 p-4`}>
      <div>
        <Label htmlFor={id}>{label}</Label>
        <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-3">
        <input
          id={id}
          type="color"
          value={value}
          aria-label={label}
          onChange={(event) => {
            const next = event.target.value.toLowerCase();
            setHexDraft(next);
            React.startTransition(() => {
              onChange(next);
            });
          }}
          className="h-11 w-11 shrink-0 cursor-pointer rounded-lg border border-input bg-background p-0.5 transition-transform hover:scale-105"
        />
        <div className="relative flex-1">
          <Input
            id={`${id}-hex`}
            value={hexDraft}
            onChange={(event) => {
              const val = event.target.value;
              setHexDraft(val);
              const testHex = val.startsWith("#") ? val : `#${val}`;
              if (/^#([0-9a-fA-F]{6})$/.test(testHex)) {
                React.startTransition(() => {
                  onChange(testHex.toLowerCase());
                });
              }
            }}
            onBlur={commitHex}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                commitHex();
              }
            }}
            placeholder={t("theme.hexPlaceholder")}
            spellCheck={false}
            autoComplete="off"
            className={cn(
              "h-11 min-h-11 font-mono text-xs pe-8",
              !isValidHex &&
                hexDraft.trim() &&
                "border-destructive/80 focus-visible:ring-destructive/30",
            )}
            aria-label={t("theme.hexAria", { label })}
          />
          {isValidHex && (
            <span
              className="absolute end-2.5 top-3.5 h-4 w-4 rounded-full border border-white/20 shadow-2xs transition-transform hover:scale-110"
              style={{ backgroundColor: hexDraft.startsWith("#") ? hexDraft : `#${hexDraft}` }}
              aria-hidden="true"
            />
          )}
        </div>
      </div>
    </div>
  );
}
