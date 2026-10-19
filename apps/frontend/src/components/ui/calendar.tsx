import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import { CalendarDropdown } from "@/components/ui/CalendarDropdown";

export type CalendarProps = DayPickerProps;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  components,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        months:
          "flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:gap-6 sm:divide-x sm:divide-border/40",
        month: "space-y-3 transition-opacity duration-150 animate-in fade-in-50",
        month_caption: "flex justify-center pt-1 relative items-center min-h-9",
        caption_label: "text-xs font-semibold text-foreground tracking-wide",
        nav: "flex items-center justify-between absolute inset-x-0 top-1 pointer-events-none z-elevated px-0.5",
        button_previous: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative h-8 w-8 min-h-8 min-w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors pointer-events-auto cursor-pointer after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
        ),
        button_next: cn(
          buttonVariants({ variant: "ghost", size: "icon" }),
          "relative h-8 w-8 min-h-8 min-w-8 p-0 text-muted-foreground hover:text-foreground hover:bg-muted/80 rounded-lg transition-colors pointer-events-auto cursor-pointer after:absolute after:start-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']",
        ),
        month_grid: "w-full border-collapse space-y-1",
        weekdays: "flex justify-around border-b border-border/40 pb-1.5 mb-1",
        weekday:
          "text-muted-foreground font-semibold text-3xs uppercase tracking-wider w-8 text-center select-none",
        week: "flex w-full mt-1 justify-around",
        day: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-sticky",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-e-lg [&:has(>.day-range-start)]:rounded-s-lg first:[&:has([aria-selected])]:rounded-s-lg last:[&:has([aria-selected])]:rounded-e-lg [&:has([aria-selected])]:bg-primary/10"
            : "[&:has([aria-selected])]:rounded-lg",
        ),
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "relative h-8 w-8 min-h-8 min-w-8 p-0 font-medium text-xs aria-selected:opacity-100 rounded-lg hover:bg-muted/80 transition-all duration-150 cursor-pointer before:absolute before:-inset-1.5 before:content-['']",
        ),
        range_start: "day-range-start",
        range_end: "day-range-end",
        selected:
          "bg-primary text-primary-foreground font-bold shadow-sm shadow-primary/30 hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground rounded-lg",
        today:
          "font-bold text-primary ring-1.5 ring-primary/40 rounded-lg [&:not([aria-selected])]:bg-primary/5",
        outside: "day-outside text-muted-foreground/40",
        disabled: "text-muted-foreground/45 cursor-not-allowed pointer-events-none",
        range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        hidden: "invisible",
        dropdowns: "flex justify-center gap-1.5 items-center z-elevated",
        ...classNames,
      }}
      {...props}
      components={{
        Chevron: ({ className: chevronClassName, orientation, ...chevronProps }) => {
          if (orientation === "left") {
            return (
              <ChevronLeft
                className={cn("h-4 w-4 rtl:rotate-180 transition-transform", chevronClassName)}
                {...chevronProps}
              />
            );
          }
          return (
            <ChevronRight
              className={cn("h-4 w-4 rtl:rotate-180 transition-transform", chevronClassName)}
              {...chevronProps}
            />
          );
        },
        Dropdown: CalendarDropdown,
        DayButton: ({ day: _day, modifiers, className: buttonClassName, ...buttonProps }) => {
          const isSelected = Boolean(modifiers.selected);
          const isToday = Boolean(modifiers.today);
          const isOutside = Boolean(modifiers.outside);
          const isDisabled = Boolean(modifiers.disabled);
          const isRangeStart = Boolean(modifiers.range_start);
          const isRangeEnd = Boolean(modifiers.range_end);
          const isRangeMiddle = Boolean(modifiers.range_middle);
          const isSingleDayRange = isRangeStart && isRangeEnd;

          return (
            <button
              type="button"
              className={cn(
                "relative h-8 w-8 min-h-8 min-w-8 p-0 font-medium text-xs transition-all duration-100 flex items-center justify-center select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background before:absolute before:-inset-1.5 before:content-['']",
                // Unselected default
                !isSelected &&
                  !isRangeMiddle &&
                  !isOutside &&
                  !isDisabled &&
                  "text-foreground font-semibold hover:bg-muted/80 rounded-lg cursor-pointer active:scale-95",
                // Today (unselected)
                isToday &&
                  !isSelected &&
                  !isRangeMiddle &&
                  "text-primary font-bold ring-1.5 ring-primary/40 bg-primary/10 hover:bg-primary/15 rounded-lg cursor-pointer active:scale-95",
                // Range Start
                isRangeStart &&
                  !isSingleDayRange &&
                  "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/30 hover:bg-primary hover:text-primary-foreground rounded-s-lg rounded-e-none cursor-pointer",
                // Range End
                isRangeEnd &&
                  !isSingleDayRange &&
                  "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/30 hover:bg-primary hover:text-primary-foreground rounded-e-lg rounded-s-none cursor-pointer",
                // Range Middle
                isRangeMiddle &&
                  "bg-primary/15 text-primary font-semibold rounded-none cursor-pointer",
                // Selected single day
                ((isSelected && !isRangeMiddle) || isSingleDayRange) &&
                  "bg-primary text-primary-foreground font-bold shadow-md shadow-primary/30 hover:bg-primary hover:text-primary-foreground rounded-lg cursor-pointer",
                // Outside month days (not disabled)
                isOutside &&
                  !isDisabled &&
                  !isSelected &&
                  !isRangeMiddle &&
                  "text-muted-foreground/40 hover:bg-muted/40 rounded-lg cursor-pointer",
                // Disabled days (clearly legible muted text without double-opacity fade)
                isDisabled &&
                  !isSelected &&
                  "text-muted-foreground/45 cursor-not-allowed pointer-events-none rounded-lg",
                buttonClassName,
              )}
              {...buttonProps}
            />
          );
        },
        ...components,
      }}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
