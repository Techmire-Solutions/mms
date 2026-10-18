import React from "react";
import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonIdentityMeta, DirectoryCardSubtitleStack } from "./PersonIdentityMeta";

vi.mock("@/hooks/useTranslation", () => ({
  useTranslation: () => ({
    language: "en",
    t: (key: string) => {
      const labels: Record<string, string> = {
        "contacts.table.yesSyed": "Syed",
        "contacts.gender.male": "Male",
        "contacts.gender.female": "Female",
      };
      return labels[key] ?? key;
    },
    isLoading: false,
    dir: "ltr" as const,
    isRtl: false,
  }),
}));

describe("PersonIdentityMeta Component", () => {
  it("returns null when no gender or syed status is provided", () => {
    const html = renderToStaticMarkup(<PersonIdentityMeta />);
    expect(html).toBe("");
  });

  it("renders gender badge for male with theme radius by default", () => {
    const html = renderToStaticMarkup(<PersonIdentityMeta gender="male" />);
    expect(html).toContain("Male");
    expect(html).toContain("rounded-md");
    expect(html).not.toContain("rounded-full");
  });

  it("renders pill shape when pill=true is explicitly set", () => {
    const html = renderToStaticMarkup(<PersonIdentityMeta gender="female" pill={true} />);
    expect(html).toContain("Female");
    expect(html).toContain("rounded-full");
  });

  it('applies medium size padding when size="md" is passed', () => {
    const html = renderToStaticMarkup(<PersonIdentityMeta gender="male" size="md" />);
    expect(html).toContain("px-2.5");
  });

  it("renders Syed badge with default localized translation when syedLabel is omitted", () => {
    const html = renderToStaticMarkup(<PersonIdentityMeta isSyed={true} />);
    expect(html).toContain("Syed");
    expect(html).toContain("rounded-md");
  });

  it("renders Syed badge with custom syedLabel when provided", () => {
    const html = renderToStaticMarkup(<PersonIdentityMeta isSyed={true} syedLabel="Hashemite" />);
    expect(html).toContain("Hashemite");
  });

  it("renders both gender and Syed badge inline", () => {
    const html = renderToStaticMarkup(<PersonIdentityMeta gender="male" isSyed={true} />);
    expect(html).toContain("Male");
    expect(html).toContain("Syed");
  });

  it("renders extraBadges and children inline", () => {
    const html = renderToStaticMarkup(
      <PersonIdentityMeta gender="male" extraBadges={<span id="gr-badge">GR-101</span>}>
        <span id="extra-child">Active</span>
      </PersonIdentityMeta>,
    );
    expect(html).toContain("GR-101");
    expect(html).toContain("Active");
  });

  it('renders interactive button with type="button" when click handlers are passed', () => {
    const onGender = vi.fn();
    const onSyed = vi.fn();
    const html = renderToStaticMarkup(
      <PersonIdentityMeta
        gender="female"
        isSyed={true}
        onGenderClick={onGender}
        onSyedClick={onSyed}
      />,
    );
    expect(html).toContain("<button");
    expect(html).toContain('type="button"');
    expect(html).toContain("Female");
    expect(html).toContain("Syed");
  });
});

describe("DirectoryCardSubtitleStack Component", () => {
  it("renders stacked children cleanly with spacing class", () => {
    const html = renderToStaticMarkup(
      <DirectoryCardSubtitleStack className="custom-class">
        <span>Line 1</span>
        <span>Line 2</span>
      </DirectoryCardSubtitleStack>,
    );
    expect(html).toContain("Line 1");
    expect(html).toContain("Line 2");
    expect(html).toContain("flex-col");
    expect(html).toContain("custom-class");
  });
});
