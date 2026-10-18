import * as React from "react";
import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "../utils";

export interface SliderProps extends React.ComponentProps<typeof SliderPrimitive.Root> {
  /**
   * Optional custom formatter for aria-valuetext to announce human-readable
   * units to assistive screen readers (e.g. (v) => `${v}%`).
   * Modern Web Guidance: slider.
   */
  formatValueText?: (value: number) => string;
}

export const Slider = ({
  ref,
  className,
  formatValueText,
  value,
  defaultValue,
  ...props
}: SliderProps) => {
  const values = value ?? defaultValue ?? [0];
  const thumbCount = Array.isArray(values) && values.length > 0 ? values.length : 1;

  return (
    <SliderPrimitive.Root
      ref={ref}
      value={value}
      defaultValue={defaultValue}
      className={cn("relative flex w-full select-none items-center", className)}
      {...props}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-primary/20">
        <SliderPrimitive.Range className="absolute h-full bg-primary" />
      </SliderPrimitive.Track>
      {Array.from({ length: thumbCount }).map((_, index) => {
        const thumbValue = Array.isArray(values) ? values[index] : undefined;
        const valueText =
          typeof thumbValue === "number" && formatValueText
            ? formatValueText(thumbValue)
            : undefined;

        return (
          <SliderPrimitive.Thumb
            key={index}
            aria-label={props["aria-label"]}
            aria-valuetext={valueText}
            className="relative block h-4 w-4 rounded-full border border-primary/50 bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']"
          />
        );
      })}
    </SliderPrimitive.Root>
  );
};
Slider.displayName = SliderPrimitive.Root.displayName;
