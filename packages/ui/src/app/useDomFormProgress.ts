import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";

export interface DomProgressResult {
  progress: number | undefined;
  label: string | undefined;
  ref: RefObject<HTMLDivElement | null>;
}

/**
 * Tracks the filled progress of form inputs dynamically using the DOM.
 */
export function useDomFormProgress(open: boolean, active: boolean): DomProgressResult {
  const [progress, setProgress] = useState<number | undefined>(undefined);
  const [label, setLabel] = useState<string | undefined>(undefined);
  const progressRef = useRef<number | undefined>(undefined);
  const labelRef = useRef<string | undefined>(undefined);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !active) {
      if (progressRef.current !== undefined) {
        progressRef.current = undefined;
        setProgress(undefined);
      }
      if (labelRef.current !== undefined) {
        labelRef.current = undefined;
        setLabel(undefined);
      }
      return;
    }

    const updateProgress = () => {
      const container = ref.current;
      if (!container) return;

      const inputs = Array.from(
        container.querySelectorAll('input, select, textarea, [role="combobox"], [role="checkbox"]'),
      ) as HTMLElement[];

      if (inputs.length === 0) {
        if (progressRef.current !== undefined) {
          progressRef.current = undefined;
          setProgress(undefined);
        }
        if (labelRef.current !== undefined) {
          labelRef.current = undefined;
          setLabel(undefined);
        }
        return;
      }

      const targetInputs = inputs.filter((el) => {
        const type = el.getAttribute("type");
        if (type === "submit" || type === "button" || type === "hidden") return false;
        return el.offsetParent !== null;
      });

      if (targetInputs.length === 0) {
        if (progressRef.current !== undefined) {
          progressRef.current = undefined;
          setProgress(undefined);
        }
        if (labelRef.current !== undefined) {
          labelRef.current = undefined;
          setLabel(undefined);
        }
        return;
      }

      const requiredInputs = targetInputs.filter(
        (el) =>
          (el as HTMLInputElement).required ||
          el.getAttribute("aria-required") === "true" ||
          el.classList.contains("required"),
      );
      const sourceList = requiredInputs.length > 0 ? requiredInputs : targetInputs;

      const filledCount = sourceList.filter((el) => {
        if (el.tagName === "INPUT") {
          const inputEl = el as HTMLInputElement;
          if (inputEl.type === "checkbox" || inputEl.type === "radio") {
            return inputEl.checked;
          }
          return inputEl.value.trim() !== "";
        }
        if (el.tagName === "SELECT" || el.tagName === "TEXTAREA") {
          return (el as HTMLSelectElement | HTMLTextAreaElement).value.trim() !== "";
        }
        if (el.getAttribute("role") === "checkbox") {
          return el.getAttribute("aria-checked") === "true";
        }
        if (el.getAttribute("role") === "combobox") {
          const text = el.textContent?.trim() || "";
          return text !== "" && !text.toLowerCase().includes("select");
        }
        return false;
      }).length;
      const percentage = Math.round((filledCount / sourceList.length) * 100);
      const newLabel = `${filledCount}/${sourceList.length}`;

      if (progressRef.current !== percentage) {
        progressRef.current = percentage;
        setProgress(percentage);
      }
      if (labelRef.current !== newLabel) {
        labelRef.current = newLabel;
        setLabel(newLabel);
      }
    };

    let debounceTimer: ReturnType<typeof setTimeout>;
    const debouncedUpdateProgress = () => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(updateProgress, 100);
    };

    const container = ref.current;
    if (!container) return;

    updateProgress();

    const observer = new MutationObserver(debouncedUpdateProgress);
    // Be careful with attributes: true, it triggers on ANY attribute change in the entire tree!
    observer.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["value", "checked", "aria-checked", "aria-required", "class"],
    });

    container.addEventListener("input", debouncedUpdateProgress);
    container.addEventListener("change", debouncedUpdateProgress);

    return () => {
      clearTimeout(debounceTimer);
      container.removeEventListener("input", debouncedUpdateProgress);
      container.removeEventListener("change", debouncedUpdateProgress);
      observer.disconnect();
    };
  }, [open, active]);

  return { progress, label, ref };
}
