import { describe, expect, it } from "vitest";
import { genderStatusBadgeConfig } from "@/lib/genderStatusBadge";
import { SEMANTIC_BADGE } from "@/lib/semanticTone";

const t = (key: string) => `[${key}]`;

describe("genderStatusBadgeConfig", () => {
  it("builds male and female configs with localized labels", () => {
    const config = genderStatusBadgeConfig(t);
    expect(config.male.label).toBe("[sessions.classes.gender.male]");
    expect(config.female.label).toBe("[sessions.classes.gender.female]");
    expect(config.male.cls).toContain("text-info");
    expect(config.female.cls).toContain("text-secondary");
  });

  it('adds an "any" option only when includeAny is set', () => {
    const without = genderStatusBadgeConfig(t);
    expect(without.any).toBeUndefined();

    const withAny = genderStatusBadgeConfig(t, { includeAny: true });
    expect(withAny.any.label).toBe("[sessions.classes.gender.any]");
    expect(withAny.any.cls).toBe(SEMANTIC_BADGE.muted);
  });
});
