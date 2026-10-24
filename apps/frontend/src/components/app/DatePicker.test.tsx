import React, { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DatePicker, type DatePickerProps } from "./DatePicker";
import type { AppTranslationKey } from "@mms/shared";

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    t: (key: AppTranslationKey, params?: Record<string, string | number>) => {
      const map: Partial<Record<AppTranslationKey, string>> = {
        "datePicker.openAria": "Open calendar",
        "datePicker.openYearAria": "Open year selector",
        "datePicker.clearAria": "Clear date",
        "datePicker.clear": "Clear",
        "datePicker.today": "Today",
        "datePicker.thisYear": "This Year",
        "datePicker.previousYears": "Previous years",
        "datePicker.nextYears": "Next years",
        "datePicker.selectYearAria": `Select year ${params?.year ?? ""}`,
        "datePicker.enterFormatAria": `Enter date in format ${params?.format ?? "DD/MM/YYYY"}`,
        "datePicker.enterYearAria": "Enter year in YYYY format",
      };
      return map[key] ?? key;
    },
  }),
}));

function changeInput(input: HTMLInputElement, value: string) {
  const descriptor = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value");
  descriptor?.set?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
  input.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("DatePicker Component", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  async function renderDatePicker(props: DatePickerProps) {
    await act(async () => {
      root.render(<DatePicker {...props} />);
    });
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    return { container, input };
  }

  it("renders with formatted display value and custom placeholder", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({
      value: "2026-07-21",
      onChange,
      placeholder: "Select a date",
      id: "custom-date-id",
      name: "birthDate",
    });

    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.value).toBe("21/07/2026");
    expect(input.id).toBe("custom-date-id");
    expect(input.name).toBe("birthDate");
    expect(input.placeholder).toBe("Select a date");

    const hiddenInput = container.querySelector(
      'input[name="birthDate_hidden"]',
    ) as HTMLInputElement;
    expect(hiddenInput).toBeInstanceOf(HTMLInputElement);
    expect(hiddenInput.value).toBe("2026-07-21");
  });

  it("auto-formats user typing numbers by inserting / between segments", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({ value: "", onChange });
    expect(input.value).toBe("");

    // User types "21"
    await act(async () => {
      changeInput(input, "21");
    });
    expect(input.value).toBe("21/");

    // User continues typing "21/07"
    await act(async () => {
      changeInput(input, "21/07");
    });
    expect(input.value).toBe("21/07/");

    // User finishes typing "21/07/2026"
    await act(async () => {
      changeInput(input, "21/07/2026");
    });
    expect(input.value).toBe("21/07/2026");
    expect(onChange).toHaveBeenCalledWith("2026-07-21");
  });

  it("allows backspacing without re-inserting trailing separator immediately", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({ value: "", onChange });

    await act(async () => {
      changeInput(input, "21");
    });
    expect(input.value).toBe("21/");

    // User deletes trailing separator
    await act(async () => {
      changeInput(input, "21");
    });
    expect(input.value).toBe("21");
  });

  it("auto-formats pasted 8-digit strings into full date with / separators", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({ value: "", onChange });

    await act(async () => {
      changeInput(input, "21072026");
    });

    expect(input.value).toBe("21/07/2026");
    expect(onChange).toHaveBeenCalledWith("2026-07-21");
  });

  it("triggers onChange with empty string when clear button is clicked", async () => {
    const onChange = vi.fn();
    await renderDatePicker({ value: "2026-07-21", onChange });

    const clearButton = container.querySelector(
      'button[aria-label="Clear date"]',
    ) as HTMLButtonElement;
    expect(clearButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      clearButton.click();
    });

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("disables trigger button and input when disabled prop is true", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({ value: "2026-07-21", onChange, disabled: true });

    expect(input.disabled).toBe(true);

    const triggerButton = container.querySelector(
      'button[aria-label="Open calendar"]',
    ) as HTMLButtonElement;
    expect(triggerButton.disabled).toBe(true);

    // Clear button should not be rendered when disabled
    const clearButton = container.querySelector('button[aria-label="Clear date"]');
    expect(clearButton).toBeNull();
  });

  it("renders required helper input when required is true and value is empty", async () => {
    const onChange = vi.fn();
    await renderDatePicker({
      value: "",
      onChange,
      required: true,
      id: "test-req",
      name: "testReq",
    });

    const helper = container.querySelector(
      'input[id="test-req-required-helper"]',
    ) as HTMLInputElement;
    expect(helper).toBeInstanceOf(HTMLInputElement);
    expect(helper.required).toBe(true);
  });

  it("handles null value and null min/max bounds props safely", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({
      value: null,
      onChange,
      min: null,
      max: null,
    });

    expect(input).toBeInstanceOf(HTMLInputElement);
    expect(input.value).toBe("");
  });

  it("opens and closes popover via trigger button click", async () => {
    const onChange = vi.fn();
    await renderDatePicker({ value: "2026-07-21", onChange });

    const triggerButton = container.querySelector(
      'button[aria-label="Open calendar"]',
    ) as HTMLButtonElement;
    expect(triggerButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      triggerButton.click();
    });

    // Popover is open: input aria-expanded is true
    const input = container.querySelector('input[type="text"]') as HTMLInputElement;
    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  it("reverts invalid or incomplete dates on blur", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({ value: "2026-07-21", onChange });

    // User types invalid date
    await act(async () => {
      changeInput(input, "30/02/2026");
    });
    expect(input.value).toBe("30/02/2026");
    expect(onChange).not.toHaveBeenCalled();

    // User blurs field: should revert to last valid date
    await act(async () => {
      input.focus();
      input.blur();
    });
    expect(input.value).toBe("21/07/2026");
  });

  it("enforces min and max bounds during typing", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({
      value: "",
      onChange,
      min: "2026-06-01",
      max: "2026-06-30",
    });

    // Out of bounds: May 15 (before min)
    await act(async () => {
      changeInput(input, "15/05/2026");
    });
    expect(onChange).not.toHaveBeenCalled();

    // In bounds: June 15
    await act(async () => {
      changeInput(input, "15/06/2026");
    });
    expect(onChange).toHaveBeenCalledWith("2026-06-15");
  });

  it("forwards accessibility attributes and custom className", async () => {
    const { input } = await renderDatePicker({
      value: "",
      onChange: vi.fn(),
      "aria-label": "Student birth date",
      "aria-invalid": true,
      "aria-describedby": "date-error-hint",
      className: "custom-date-picker-class",
    });

    expect(input.getAttribute("aria-label")).toBe("Student birth date");
    expect(input.getAttribute("aria-invalid")).toBe("true");
    expect(input.getAttribute("aria-describedby")).toBe("date-error-hint");
    expect(container.firstElementChild?.classList.contains("custom-date-picker-class")).toBe(true);
  });

  it("clears value when user deletes all text from input", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({ value: "2026-07-21", onChange });
    expect(input.value).toBe("21/07/2026");

    await act(async () => {
      changeInput(input, "");
    });

    expect(input.value).toBe("");
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("selects today and closes popover when Today button is clicked in calendar footer", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({ value: "", onChange });

    const triggerButton = container.querySelector(
      'button[aria-label="Open calendar"]',
    ) as HTMLButtonElement;
    await act(async () => {
      triggerButton.click();
    });

    const todayButton = Array.from(document.body.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Today",
    );
    expect(todayButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      todayButton?.click();
    });

    expect(onChange).toHaveBeenCalled();
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("clears value when Clear button is clicked in calendar footer", async () => {
    const onChange = vi.fn();
    await renderDatePicker({ value: "2026-07-21", onChange });

    const triggerButton = container.querySelector(
      'button[aria-label="Open calendar"]',
    ) as HTMLButtonElement;
    await act(async () => {
      triggerButton.click();
    });

    const footerClearButton = Array.from(document.body.querySelectorAll("button")).find(
      (btn) => btn.textContent === "Clear",
    );
    expect(footerClearButton).toBeInstanceOf(HTMLButtonElement);

    await act(async () => {
      footerClearButton?.click();
    });

    expect(onChange).toHaveBeenCalledWith("");
  });

  it("commits typed date and closes popover when Enter key is pressed", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({ value: "", onChange });

    const triggerButton = container.querySelector(
      'button[aria-label="Open calendar"]',
    ) as HTMLButtonElement;
    await act(async () => {
      triggerButton.click();
    });
    expect(input.getAttribute("aria-expanded")).toBe("true");

    await act(async () => {
      changeInput(input, "15/08/2026");
    });

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    });

    expect(input.value).toBe("15/08/2026");
    expect(onChange).toHaveBeenCalledWith("2026-08-15");
    expect(input.getAttribute("aria-expanded")).toBe("false");
  });

  it("updates displayed input value when parent value prop changes", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({ value: "2026-07-21", onChange });
    expect(input.value).toBe("21/07/2026");

    // Parent updates value prop
    await act(async () => {
      root.render(<DatePicker value="2026-08-15" onChange={onChange} />);
    });
    expect(input.value).toBe("15/08/2026");
  });

  it("opens popover when ArrowDown key is pressed on the input", async () => {
    const onChange = vi.fn();
    const { input } = await renderDatePicker({ value: "", onChange });
    expect(input.getAttribute("inputmode")).toBe("numeric");
    expect(input.getAttribute("aria-expanded")).toBe("false");

    await act(async () => {
      input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    expect(input.getAttribute("aria-expanded")).toBe("true");
  });

  describe('Year-Only (mode="year" and yearOnly) Mode', () => {
    it("renders year value from 4-digit string, number, or ISO date", async () => {
      const onChange = vi.fn();
      const { input } = await renderDatePicker({
        mode: "year",
        value: "2026",
        onChange,
        id: "academic-year",
        name: "academicYear",
      });

      expect(input.value).toBe("2026");
      expect(input.placeholder).toBe("YYYY");
      expect(input.maxLength).toBe(4);

      const hiddenInput = container.querySelector(
        'input[name="academicYear_hidden"]',
      ) as HTMLInputElement;
      expect(hiddenInput).toBeInstanceOf(HTMLInputElement);
      expect(hiddenInput.value).toBe("2026");

      // Test with yearOnly boolean alias
      await act(async () => {
        root.render(<DatePicker yearOnly value={2028} onChange={onChange} />);
      });
      expect(input.value).toBe("2028");

      // Test with ISO date string value
      await act(async () => {
        root.render(<DatePicker mode="year" value="2025-05-12" onChange={onChange} />);
      });
      expect(input.value).toBe("2025");
    });

    it("allows direct YYYY numeric input and restricts to 4 digits", async () => {
      const onChange = vi.fn();
      const { input } = await renderDatePicker({ mode: "year", value: "", onChange });

      // Typing non-digit characters is stripped
      await act(async () => {
        changeInput(input, "abc20");
      });
      expect(input.value).toBe("20");
      expect(onChange).not.toHaveBeenCalled();

      // Complete 4 digits
      await act(async () => {
        changeInput(input, "2026");
      });
      expect(input.value).toBe("2026");
      expect(onChange).toHaveBeenCalledWith("2026");
    });

    it("enforces minYear and maxYear bounds during typing and blur", async () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      const { input } = await renderDatePicker({
        mode: "year",
        value: "2024",
        minYear: 2020,
        maxYear: 2030,
        onChange,
        onBlur,
      });

      // Typing out-of-bounds year: 2018 (below minYear 2020)
      await act(async () => {
        changeInput(input, "2018");
      });
      expect(onChange).not.toHaveBeenCalled();

      // Blur should revert to previous valid value
      await act(async () => {
        input.focus();
        input.blur();
      });
      expect(input.value).toBe("2024");
      expect(onBlur).toHaveBeenCalled();

      // Typing in-bounds year: 2027
      await act(async () => {
        changeInput(input, "2027");
      });
      expect(onChange).toHaveBeenCalledWith("2027");
    });

    it("opens popover displaying 3x4 year grid and selects year on click", async () => {
      const onChange = vi.fn();
      await renderDatePicker({ mode: "year", value: "2026", onChange });

      const triggerButton = container.querySelector(
        'button[aria-label="Open year selector"]',
      ) as HTMLButtonElement;
      expect(triggerButton).toBeInstanceOf(HTMLButtonElement);

      await act(async () => {
        triggerButton.click();
      });

      // Year grid is visible
      const yearGrid = document.body.querySelector('[role="grid"]');
      expect(yearGrid).not.toBeNull();

      // Decade range header
      expect(document.body.textContent).toContain("2020 – 2031");

      // Click year 2028 in the grid
      const year2028Button = Array.from(document.body.querySelectorAll('[role="gridcell"]')).find(
        (el) => el.textContent?.trim() === "2028",
      ) as HTMLButtonElement;
      expect(year2028Button).toBeInstanceOf(HTMLButtonElement);

      await act(async () => {
        year2028Button.click();
      });

      expect(onChange).toHaveBeenCalledWith("2028");
      const input = container.querySelector('input[type="text"]') as HTMLInputElement;
      expect(input.getAttribute("aria-expanded")).toBe("false");
    });

    it("navigates previous and next year pages in popover grid", async () => {
      const onChange = vi.fn();
      await renderDatePicker({ mode: "year", value: "2026", onChange });

      const triggerButton = container.querySelector(
        'button[aria-label="Open year selector"]',
      ) as HTMLButtonElement;
      await act(async () => {
        triggerButton.click();
      });

      expect(document.body.textContent).toContain("2020 – 2031");

      // Click Next decade
      const nextButton = document.body.querySelector(
        'button[aria-label="Next years"]',
      ) as HTMLButtonElement;
      expect(nextButton).toBeInstanceOf(HTMLButtonElement);

      await act(async () => {
        nextButton.click();
      });
      expect(document.body.textContent).toContain("2032 – 2043");

      // Click Previous decade
      const prevButton = document.body.querySelector(
        'button[aria-label="Previous years"]',
      ) as HTMLButtonElement;
      expect(prevButton).toBeInstanceOf(HTMLButtonElement);

      await act(async () => {
        prevButton.click();
      });
      expect(document.body.textContent).toContain("2020 – 2031");
    });

    it("disables out-of-bounds year buttons in the grid", async () => {
      const onChange = vi.fn();
      await renderDatePicker({
        mode: "year",
        value: "2026",
        minYear: 2024,
        maxYear: 2028,
        onChange,
      });

      const triggerButton = container.querySelector(
        'button[aria-label="Open year selector"]',
      ) as HTMLButtonElement;
      await act(async () => {
        triggerButton.click();
      });

      const year2022Button = Array.from(document.body.querySelectorAll('[role="gridcell"]')).find(
        (el) => el.textContent?.trim() === "2022",
      ) as HTMLButtonElement;
      expect(year2022Button).toBeInstanceOf(HTMLButtonElement);
      expect(year2022Button.disabled).toBe(true);

      const year2026Button = Array.from(document.body.querySelectorAll('[role="gridcell"]')).find(
        (el) => el.textContent?.trim() === "2026",
      ) as HTMLButtonElement;
      expect(year2026Button).toBeInstanceOf(HTMLButtonElement);
      expect(year2026Button.disabled).toBe(false);
    });

    it("selects this year and clears value via popover footer buttons", async () => {
      const onChange = vi.fn();
      await renderDatePicker({ mode: "year", value: "", onChange });

      const triggerButton = container.querySelector(
        'button[aria-label="Open year selector"]',
      ) as HTMLButtonElement;
      await act(async () => {
        triggerButton.click();
      });

      const thisYearButton = Array.from(document.body.querySelectorAll("button")).find(
        (btn) => btn.textContent === "This Year",
      );
      expect(thisYearButton).toBeInstanceOf(HTMLButtonElement);

      await act(async () => {
        thisYearButton?.click();
      });

      const currentYear = String(new Date().getFullYear());
      expect(onChange).toHaveBeenCalledWith(currentYear);

      // Re-render with value and clear via footer button
      await act(async () => {
        root.render(<DatePicker mode="year" value={currentYear} onChange={onChange} />);
      });

      await act(async () => {
        triggerButton.click();
      });

      const clearButton = Array.from(document.body.querySelectorAll("button")).find(
        (btn) => btn.textContent === "Clear",
      );
      expect(clearButton).toBeInstanceOf(HTMLButtonElement);

      await act(async () => {
        clearButton?.click();
      });

      expect(onChange).toHaveBeenCalledWith("");
    });

    it("forwards ref to the underlying HTMLInputElement for React Hook Form compatibility", async () => {
      const ref = React.createRef<HTMLInputElement>();
      await act(async () => {
        root.render(<DatePicker ref={ref} mode="year" value="2026" onChange={vi.fn()} />);
      });

      expect(ref.current).toBeInstanceOf(HTMLInputElement);
      expect(ref.current?.value).toBe("2026");
    });
  });

  describe("Tri-Format Flexible Date Support (Year, Month-Year, Complete Date)", () => {
    it("accepts and renders Year-only values (YYYY) in standard datepicker", async () => {
      const onChange = vi.fn();
      const { input } = await renderDatePicker({ value: "2024", onChange });

      expect(input.value).toBe("2024");

      // Typing a 4-digit year commits the year
      await act(async () => {
        changeInput(input, "1998");
      });
      expect(onChange).toHaveBeenCalledWith("1998");
    });

    it("accepts and renders Month-and-Year values (MM/YYYY -> YYYY-MM) in standard datepicker", async () => {
      const onChange = vi.fn();
      const { input } = await renderDatePicker({ value: "2024-05", onChange });

      expect(input.value).toBe("05/2024");

      // Typing month/year commits YYYY-MM
      await act(async () => {
        changeInput(input, "07/2025");
      });
      expect(onChange).toHaveBeenCalledWith("2025-07");
    });

    it("accepts and renders Complete Date values (DD/MM/YYYY -> YYYY-MM-DD)", async () => {
      const onChange = vi.fn();
      const { input } = await renderDatePicker({ value: "2024-05-21", onChange });

      expect(input.value).toBe("21/05/2024");

      await act(async () => {
        changeInput(input, "15/08/2026");
      });
      expect(onChange).toHaveBeenCalledWith("2026-08-15");
    });

    it("preserves partial date entries on blur without resetting to empty or full date", async () => {
      const onChange = vi.fn();
      const onBlur = vi.fn();
      const { input } = await renderDatePicker({ value: "", onChange, onBlur });

      // Enter Year-only and blur
      await act(async () => {
        changeInput(input, "2024");
        input.focus();
        input.blur();
      });
      expect(input.value).toBe("2024");
      expect(onChange).toHaveBeenCalledWith("2024");

      // Enter Month-and-Year and blur
      await act(async () => {
        changeInput(input, "09/2025");
        input.focus();
        input.blur();
      });
      expect(input.value).toBe("09/2025");
      expect(onChange).toHaveBeenCalledWith("2025-09");
    });
  });

  describe("Date Format Resolution", () => {
    it("renders with custom dateFormat prop (YYYY-MM-DD)", async () => {
      const onChange = vi.fn();
      const { input } = await renderDatePicker({
        value: "2026-07-21",
        onChange,
        dateFormat: "YYYY-MM-DD",
      });

      expect(input.value).toBe("2026-07-21");
      expect(input.placeholder).toBe("YYYY-MM-DD");
    });

    it("renders with custom dateFormat prop (MM/DD/YYYY)", async () => {
      const onChange = vi.fn();
      const { input } = await renderDatePicker({
        value: "2026-07-21",
        onChange,
        dateFormat: "MM/DD/YYYY",
      });

      expect(input.value).toBe("07/21/2026");
      expect(input.placeholder).toBe("MM/DD/YYYY");
    });
  });
});
