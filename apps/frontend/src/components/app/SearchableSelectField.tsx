import { useId } from "react";
import { FORM_LABEL } from "../ui/formStyles";
import { FormSelect, type FormSelectProps } from "./FormSelect";
import { RequiredMark } from "./FormField";
import { Button } from "../ui/button";

export interface SearchableSelectFieldProps extends Pick<
  FormSelectProps,
  | "value"
  | "onChange"
  | "options"
  | "placeholder"
  | "disabled"
  | "required"
  | "id"
  | "name"
  | "onSearchChange"
  | "isSearching"
> {
  label: string;
  /** Overrides the built-in search input's accessible name. */
  searchLabel?: string;
  /** Overrides the built-in search input placeholder. */
  searchPlaceholder?: string;
  loadingLabel: string;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  retryLabel?: string;
  hint?: string;
}

/**
 * Labelled searchable select. Searching lives inside the FormSelect popover —
 * there is deliberately no second, standalone search input above the field.
 */
export function SearchableSelectField({
  label,
  searchLabel,
  searchPlaceholder,
  loadingLabel,
  isLoading = false,
  error,
  onRetry,
  retryLabel,
  hint,
  id,
  name,
  onSearchChange,
  ...selectProps
}: SearchableSelectFieldProps): React.JSX.Element {
  const generatedId = useId();
  const selectId = id ?? generatedId;
  const feedbackId = `${selectId}-feedback`;
  const feedback = error || (isLoading ? loadingLabel : hint);

  return (
    <div className="space-y-1.5" aria-busy={isLoading}>
      <label htmlFor={selectId} className={FORM_LABEL}>
        {label}
        {selectProps.required && <RequiredMark />}
      </label>
      <FormSelect
        {...selectProps}
        id={selectId}
        name={name ?? selectId}
        searchable
        onSearchChange={onSearchChange}
        /* A remote search owns matching (email/CNIC/phone), so keep its results verbatim. */
        filterSearchLocally={onSearchChange ? false : undefined}
        isSearching={isLoading}
        searchLabels={{ search: searchLabel, searchPlaceholder }}
        aria-invalid={Boolean(error)}
        aria-describedby={feedback ? feedbackId : undefined}
      />
      {feedback && (
        <p
          id={feedbackId}
          role={error ? "alert" : "status"}
          className={error ? "text-xs text-destructive" : "text-xs text-muted-foreground"}
        >
          {feedback}
        </p>
      )}
      {error && onRetry && retryLabel && (
        <Button
          type="button"
          variant="outline"
          onClick={onRetry}
          disabled={selectProps.disabled || isLoading}
        >
          {retryLabel}
        </Button>
      )}
    </div>
  );
}
