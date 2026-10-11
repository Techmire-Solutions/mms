import { useId } from "react";
import { FORM_LABEL } from "./formStyles";
import { FormSelect, type FormSelectProps } from "./FormSelect";
import { SearchBar } from "./SearchBar";
import { Button } from "./button";

export interface SearchableSelectFieldProps extends Pick<
  FormSelectProps,
  "value" | "onChange" | "options" | "placeholder" | "disabled" | "required" | "id" | "name"
> {
  label: string;
  search: string;
  onSearchChange: (search: string) => void;
  searchLabel: string;
  searchPlaceholder: string;
  loadingLabel: string;
  isLoading?: boolean;
  error?: string;
  onRetry?: () => void;
  retryLabel?: string;
  hint?: string;
}

export function SearchableSelectField({
  label,
  search,
  onSearchChange,
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
        {selectProps.required ? " *" : ""}
      </label>
      {!selectProps.disabled && (
        <SearchBar
          id={`${selectId}-search`}
          name={`${selectId}-search`}
          value={search}
          onChange={onSearchChange}
          ariaLabel={searchLabel}
          placeholder={searchPlaceholder}
          isSearching={isLoading}
        />
      )}
      <FormSelect
        {...selectProps}
        id={selectId}
        name={name ?? selectId}
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
