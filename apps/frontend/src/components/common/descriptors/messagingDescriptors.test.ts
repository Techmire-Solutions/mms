import { describe, expect, it } from "vitest";
import { APP_TRANSLATIONS_EN } from "@mms/shared";
import { messagingEntityDescriptor } from "./messagingDescriptors";

type TranslationKey = keyof typeof APP_TRANSLATIONS_EN;

describe("messagingEntityDescriptor", () => {
  it("resolves every labelKey to a defined translation", () => {
    // The Work filter chips render `field.label` after `useStaticEntityDescriptor`
    // resolves `labelKey` through `t`. `translateApp` returns the key itself when
    // it is missing, so an undefined labelKey leaks raw `messaging.columns.*`
    // strings into the UI.
    for (const field of messagingEntityDescriptor.fields) {
      if (!field.labelKey) continue;
      expect(typeof APP_TRANSLATIONS_EN[field.labelKey as TranslationKey], field.labelKey).toBe(
        "string",
      );
      expect(APP_TRANSLATIONS_EN[field.labelKey as TranslationKey]).not.toBe(field.labelKey);
    }
  });

  it("keeps filterable fields aligned with the Work filter keys", () => {
    const filterable = messagingEntityDescriptor.fields
      .filter((field) => field.filterable)
      .map((field) => field.key)
      .sort();

    expect(filterable).toEqual(["category", "channel", "endDate", "search", "startDate", "status"]);
  });
});
