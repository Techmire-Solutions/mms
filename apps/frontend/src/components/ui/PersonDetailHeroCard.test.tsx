import React from "react";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PersonDetailHeroCard } from "@/components/ui/PersonDetailHeroCard";

describe("PersonDetailHeroCard Component", () => {
  it("renders display name and avatar initials", () => {
    const html = renderToStaticMarkup(
      <PersonDetailHeroCard
        id="usr-1"
        displayName="Syeda Fatima"
        gender="female"
        accentColor="secondary"
      />,
    );

    expect(html).toContain("Syeda Fatima");
    expect(html).toContain("SF");
    expect(html).toContain('title="Syeda Fatima"');
  });

  it("renders meta row when children are provided", () => {
    const html = renderToStaticMarkup(
      <PersonDetailHeroCard id="usr-2" displayName="Ali Raza" gender="male">
        <span id="badge-active">Active</span>
        <span id="badge-gr">GR-100</span>
      </PersonDetailHeroCard>,
    );

    expect(html).toContain("Ali Raza");
    expect(html).toContain("badge-active");
    expect(html).toContain("badge-gr");
    expect(html).toContain("bg-info/45");
  });

  it("applies custom className and CARD_STRIPE_INSET", () => {
    const html = renderToStaticMarkup(
      <PersonDetailHeroCard
        id="usr-3"
        displayName="Test User"
        accentColor="primary"
        className="custom-hero-class"
      />,
    );

    expect(html).toContain("custom-hero-class");
    expect(html).toContain("ps-5");
  });

  it("omits CARD_STRIPE_INSET when accentColor={false}", () => {
    const html = renderToStaticMarkup(
      <PersonDetailHeroCard id="usr-4" displayName="Plain User" accentColor={false} />,
    );

    expect(html).not.toContain("ps-5");
    expect(html).not.toContain("sm:ps-6");
  });
});
