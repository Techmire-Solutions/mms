import * as React from "react";
import { Circle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RadioGroupContextValue {
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  disabled?: boolean;
}

const RadioGroupContext = React.createContext<RadioGroupContextValue>({});

export interface RadioGroupProps extends React.ComponentProps<"div"> {
  name?: string;
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  disabled?: boolean;
}

function RadioGroup({
  className,
  name,
  value: controlledValue,
  defaultValue,
  onValueChange,
  disabled,
  children,
  ref,
  ...props
}: RadioGroupProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState<string | undefined>(
    defaultValue,
  );
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : uncontrolledValue;

  const onChange = React.useCallback(
    (nextValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(nextValue);
      }
      onValueChange?.(nextValue);
    },
    [isControlled, onValueChange],
  );

  // Stable context identity so consumers don't re-render on every parent render.
  const contextValue = React.useMemo<RadioGroupContextValue>(
    () => ({ name, value, onChange, disabled }),
    [name, value, onChange, disabled],
  );

  return (
    <RadioGroupContext.Provider value={contextValue}>
      <div ref={ref} role="radiogroup" className={cn("grid gap-2", className)} {...props}>
        {children}
      </div>
    </RadioGroupContext.Provider>
  );
}

export interface RadioGroupItemProps extends Omit<React.ComponentProps<"button">, "onChange"> {
  value: string;
}

function RadioGroupItem({
  className,
  value,
  id,
  disabled: itemDisabled,
  "aria-label": ariaLabel,
  ref,
  ...props
}: RadioGroupItemProps) {
  const context = React.useContext(RadioGroupContext);
  const checked = context.value === value;
  const disabled = itemDisabled || context.disabled;

  return (
    <button
      ref={ref}
      type="button"
      role="radio"
      id={id}
      aria-checked={checked}
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={() => {
        if (!disabled) {
          context.onChange?.(value);
        }
      }}
      className={cn(
        "relative flex h-11 w-11 min-h-11 min-w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-primary transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 touch-manipulation",
        className,
      )}
      {...props}
    >
      <span
        className={cn(
          "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-primary shadow transition-colors",
          checked
            ? "border-primary bg-primary text-primary-foreground"
            : "border-muted-foreground/40 bg-background",
        )}
      >
        {checked && <Circle className="h-2 w-2 fill-current text-current" />}
      </span>
    </button>
  );
}

export { RadioGroup, RadioGroupItem };
