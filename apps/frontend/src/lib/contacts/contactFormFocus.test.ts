import { describe, expect, it, vi } from "vitest";
import * as formAutoScroll from "@/lib/forms/formAutoScroll";
import { contactFieldCandidateIds, focusContactField } from "@/lib/contacts/contactFormFocus";

describe("contactFieldCandidateIds", () => {
  it("targets the basic-field control id first", () => {
    const candidates = contactFieldCandidateIds({
      formInstanceId: "new-abc123",
      tabId: "basic",
      fieldId: "firstName",
    });

    expect(candidates[0]).toBe("cf-new-abc123-firstName");
  });

  it("includes the singular sub-list row id for indexed errors", () => {
    const candidates = contactFieldCandidateIds({
      formInstanceId: "new-abc123",
      tabId: "phones",
      fieldId: "number",
      index: 2,
    });

    // Phones inputs render as cf-<instance>-phone-number-<index>.
    expect(candidates).toContain("cf-new-abc123-phone-number-2");
    expect(candidates).toContain("new-abc123-phones-2");
    expect(candidates).toContain("phones-2-number");
  });

  it("returns nothing without a field id so the aria-invalid fallback runs", () => {
    expect(
      contactFieldCandidateIds({ formInstanceId: "x", tabId: "basic", fieldId: undefined }),
    ).toEqual([]);
  });
});

describe("focusContactField", () => {
  it("delegates to the shared scroll/focus helper with a form fallback", () => {
    const spy = vi.spyOn(formAutoScroll, "scrollAndFocusFirstError").mockReturnValue(true);

    focusContactField({
      formInstanceId: "new-abc123",
      tabId: "basic",
      fieldId: "firstName",
    });

    expect(spy).toHaveBeenCalledWith(["cf-new-abc123-firstName", "firstName"], {
      behavior: "smooth",
      block: "center",
      fallbackSelector: '[aria-invalid="true"]',
    });
    spy.mockRestore();
  });
});
