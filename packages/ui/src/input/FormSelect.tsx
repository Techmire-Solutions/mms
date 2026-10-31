import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../utils";
import { FORM_SELECT } from "../theme/formStyles";
import { Popover, PopoverAnchor } from "../popover/Popover";
import { FormSelectSearchContent } from "./FormSelectSearchContent";
import { FORM_SELECT_SEARCH_MIN_OPTIONS, useFormSelectSearch } from "./useFormSelectSearch";

export interface FormSelectOption {
  value: string;
  label: string;
}

export interface FormSelectSearchLabels {
  search?: string;
  searchPlaceholder?: string;
  noMatchingOptions?: string;
}

export interface FormSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: readonly (FormSelectOption | string)[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  id?: string;
  name?: string;
  required?: boolean;
  /**
   * Open a type-to-filter popover instead of the native list. Defaults to
   * on when there are at least `FORM_SELECT_SEARCH_MIN_OPTIONS` choices.
   */
  searchable?: boolean;
  "aria-label"?: string;
  "aria-invalid"?: boolean | "true" | "false";
  "aria-describedby"?: string;
  /** Optional custom labels for the search popover */
  searchLabels?: FormSelectSearchLabels;
}

const OPEN_KEYS = new Set(["Enter", " ", "F4"]);

/**
 * Native select with a visible chevron. Long lists open a searchable popover
 * (select2-style); the native `<select>` stays the form/focus/validation SSOT.
 */
export function FormSelect({
  value,
  onChange,
  options,
  placeholder,
  disabled = false,
  className,
  id,
  name,
  required,
  searchable,
  "aria-label": ariaLabel,
  "aria-invalid": ariaInvalid,
  "aria-describedby": ariaDescribedBy,
  searchLabels,
}: FormSelectProps): React.JSX.Element {
  const fallbackId = React.useId();
  const resolvedId = id || fallbackId;
  const resolvedName = name || fallbackId;
  const selectRef = React.useRef<HTMLSelectElement>(null);
  const normalized = React.useMemo(
    () =>
      (Array.isArray(options) ? options : []).map((option: FormSelectOption | string) =>
        typeof option === "string" ? { value: option, label: option } : option,
      ),
    [options],
  );
  const listOptions = React.useMemo(
    () =>
      placeholder !== undefined ? [{ value: "", label: placeholder }, ...normalized] : normalized,
    [normalized, placeholder],
  );
  const isSearchable =
    !disabled && (searchable ?? normalized.length >= FORM_SELECT_SEARCH_MIN_OPTIONS);
  const search = useFormSelectSearch({ options: listOptions, value, onPick: onChange });

  const handleSelectKeyDown = (event: React.KeyboardEvent<HTMLSelectElement>): void => {
    if (event.ctrlKey || event.metaKey) return;
    if (OPEN_KEYS.has(event.key) || (event.altKey && event.key === "ArrowDown")) {
      event.preventDefault();
      search.openWith();
    } else if (!event.altKey && event.key.length === 1) {
      event.preventDefault();
      search.openWith(event.key);
    }
  };

  return (
    <Popover
      open={isSearchable && search.open}
      onOpenChange={(open) => (open ? search.openWith() : search.close())}
    >
      <PopoverAnchor asChild>
        <div className={cn("relative", className)}>
          <select
            ref={selectRef}
            id={resolvedId}
            name={resolvedName}
            aria-label={ariaLabel}
            aria-invalid={ariaInvalid}
            aria-describedby={ariaDescribedBy}
            aria-expanded={isSearchable ? search.open : undefined}
            required={required}
            disabled={disabled}
            value={value}
            onChange={(event) => onChange(event.target.value)}
            onKeyDown={isSearchable ? handleSelectKeyDown : undefined}
            className={cn(
              FORM_SELECT,
              "appearance-none pe-10 disabled:cursor-not-allowed disabled:opacity-50",
              !disabled && !isSearchable && "cursor-pointer",
              isSearchable && "pointer-events-none",
            )}
          >
            {listOptions.map((option, index) => (
              <option key={`${option.value}-${index}`} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          {isSearchable ? (
            <div
              aria-hidden="true"
              data-form-select-hit-area=""
              className="absolute inset-0 cursor-pointer"
              onMouseDown={(event) => {
                event.preventDefault();
                selectRef.current?.focus();
                if (search.open) search.close();
                else search.openWith();
              }}
            />
          ) : null}
          <ChevronDown
            className={cn(
              "pointer-events-none absolute end-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground transition-transform duration-200",
              isSearchable && search.open && "rotate-180",
            )}
            aria-hidden="true"
          />
        </div>
      </PopoverAnchor>
      {isSearchable && search.open ? (
        <FormSelectSearchContent
          baseId={resolvedId}
          value={value}
          search={search}
          returnFocusRef={selectRef}
          ariaLabel={ariaLabel}
          searchLabel={searchLabels?.search}
          searchPlaceholder={searchLabels?.searchPlaceholder}
          noMatchingOptionsLabel={searchLabels?.noMatchingOptions}
        />
      ) : null}
    </Popover>
  );
}
