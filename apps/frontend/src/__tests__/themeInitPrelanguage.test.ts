/// <reference types="node" />
import { readFileSync } from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";
import { getLanguageDirection } from "@mms/shared";
import { ENTRY_PATHS, ROUTES } from "@/lib/config/routes";
import { TENANT_PATHS } from "@/lib/routing/moduleRegistry";

// Vitest runs with the frontend package as cwd (`pnpm --filter mms-frontend test`).
const THEME_INIT_PATH = path.resolve(process.cwd(), "public/theme-init.js");
const themeInitSource = readFileSync(THEME_INIT_PATH, "utf8");

function extractQuotedList(name: string): string[] {
  const block = new RegExp(`var ${name} = \\[([\\s\\S]*?)\\];`).exec(themeInitSource)?.[1];
  if (!block) throw new Error(`Could not find ${name} in theme-init.js`);
  return [...block.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
}

function extractString(name: string): string {
  const value = new RegExp(`var ${name} = "([^"]+)";`).exec(themeInitSource)?.[1];
  if (!value) throw new Error(`Could not find ${name} in theme-init.js`);
  return value;
}

function extractFontClasses(): Record<string, string> {
  const block = /var FONT_CLASSES = \{([\s\S]*?)\};/.exec(themeInitSource)?.[1];
  if (!block) throw new Error("Could not find FONT_CLASSES in theme-init.js");
  return Object.fromEntries(
    [...block.matchAll(/([a-z]{2}): "([^"]+)"/g)].map((match) => [match[1], match[2]]),
  );
}

interface RunOptions {
  hostname?: string;
  pathname?: string;
  settings?: Record<string, unknown> | null;
  rawSettings?: string;
}

/**
 * Executes the real `public/theme-init.js` against a fake document so the
 * pre-paint language/direction contract is proven, not just the helper parity.
 */
function runThemeInit(options: RunOptions = {}) {
  const classes = new Set<string>();
  const attributes = new Map<string, string>();
  const stored = new Map<string, string>();
  if (options.rawSettings !== undefined) {
    stored.set("mms_global_settings", options.rawSettings);
  } else if (options.settings) {
    stored.set("mms_global_settings", JSON.stringify(options.settings));
  }

  const documentElement = {
    classList: {
      add: (name: string) => classes.add(name),
      remove: (name: string) => classes.delete(name),
    },
    style: {} as Record<string, string>,
    setAttribute: (name: string, value: string) => attributes.set(name, value),
  };

  const sandbox = {
    window: {
      matchMedia: () => ({ matches: false }),
      __zod_globalConfig: undefined as unknown,
    },
    document: {
      documentElement,
      querySelector: () => null,
    },
    location: {
      hostname: options.hostname ?? "school.example.com",
      pathname: options.pathname ?? "/students",
    },
    localStorage: {
      getItem: (key: string) => stored.get(key) ?? null,
    },
  };

  vm.runInNewContext(themeInitSource, sandbox);

  return {
    lang: attributes.get("lang"),
    dir: attributes.get("dir"),
    classes,
  };
}

describe("theme-init pre-paint language/direction", () => {
  it("keeps ENTRY_PATHS in sync with the router entry paths", () => {
    expect(extractQuotedList("ENTRY_PATHS")).toEqual([...ENTRY_PATHS, ROUTES.onboarding]);
  });

  it("keeps the RTL language set in sync with getLanguageDirection", () => {
    const rtlLanguages = extractQuotedList("RTL_LANGUAGES");
    for (const language of rtlLanguages) {
      expect(getLanguageDirection(language)).toBe("rtl");
    }
    expect(getLanguageDirection("en")).toBe("ltr");
    expect([...rtlLanguages].sort()).toEqual(["ar", "fa", "ur"]);
  });

  it("keeps the font classes in sync with the direction provider", () => {
    expect(extractFontClasses()).toEqual({
      ar: "font-arabic",
      ur: "font-urdu",
      fa: "font-persian",
    });
  });

  it("reserves the platform prefix for apex-only routes", () => {
    const platformPrefix = extractString("PLATFORM_PREFIX");
    const platformPaths = Object.values(ROUTES).filter((path) => path.startsWith("/platform"));
    expect(platformPaths.length).toBeGreaterThan(0);
    for (const path of platformPaths) {
      expect(path.startsWith(platformPrefix)).toBe(true);
    }
    for (const path of Object.values(TENANT_PATHS)) {
      expect(path.startsWith(platformPrefix)).toBe(false);
    }
  });

  it("applies RTL and the matching font class before paint for an Arabic workspace", () => {
    const result = runThemeInit({ settings: { language: "ar", theme: "light" } });

    expect(result.lang).toBe("ar");
    expect(result.dir).toBe("rtl");
    expect(result.classes.has("font-arabic")).toBe(true);
    expect(result.classes.has("font-urdu")).toBe(false);
  });

  it("applies LTR for an English workspace", () => {
    const result = runThemeInit({ settings: { language: "en", theme: "dark" } });

    expect(result.lang).toBe("en");
    expect(result.dir).toBe("ltr");
    expect(result.classes.has("font-arabic")).toBe(false);
    expect(result.classes.has("dark")).toBe(true);
  });

  it("forces English on tenant auth entry paths", () => {
    const result = runThemeInit({ pathname: "/login", settings: { language: "ur" } });

    expect(result.lang).toBe("en");
    expect(result.dir).toBe("ltr");
  });

  it("forces English on the platform apex console", () => {
    const result = runThemeInit({ pathname: "/platform/workspaces", settings: { language: "fa" } });

    expect(result.lang).toBe("en");
    expect(result.dir).toBe("ltr");
  });

  it("falls back to English for an unknown language value", () => {
    const result = runThemeInit({ settings: { language: "fr" } });

    expect(result.lang).toBe("en");
    expect(result.dir).toBe("ltr");
  });

  it("does not throw on malformed persisted settings", () => {
    const result = runThemeInit({ rawSettings: "{not-json" });

    expect(result.lang).toBe("en");
    expect(result.dir).toBe("ltr");
  });
});
