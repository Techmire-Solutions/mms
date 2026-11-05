import fs from "node:fs";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { buttonVariants } from "@/components/ui/button";
import { ModuleFiltersMenuTrigger } from "@/components/app/ModuleFiltersMenuButton";
import {
  WORK_TOOLBAR_TRIGGER,
  WORK_TOOLBAR_TRIGGER_FILTER_ACTIVE,
  WORK_TOOLBAR_TRIGGER_FILTER_IDLE,
  WORK_TOOLBAR_TRIGGER_IDLE,
} from "@/components/ui/formStyles";

describe("Button Hover Contrast & Filters Trigger Contract", () => {
  it("enforces hover:text-foreground and hover:bg-muted on ghost button variant", () => {
    const ghostClass = buttonVariants({ variant: "ghost" });
    expect(ghostClass.includes("hover:bg-muted")).toBe(true);
    expect(ghostClass.includes("hover:text-foreground")).toBe(true);
    expect(ghostClass.includes("hover:text-accent-foreground")).toBe(false);
  });

  it("enforces hover:text-foreground and hover:bg-muted on outline button variant", () => {
    const outlineClass = buttonVariants({ variant: "outline" });
    expect(outlineClass.includes("hover:bg-muted")).toBe(true);
    expect(outlineClass.includes("hover:text-foreground")).toBe(true);
    expect(outlineClass.includes("hover:text-accent-foreground")).toBe(false);
  });

  it("enforces WORK_TOOLBAR_TRIGGER and trigger idle tokens carry hover:text-foreground", () => {
    expect(WORK_TOOLBAR_TRIGGER.includes("hover:bg-muted")).toBe(true);
    expect(WORK_TOOLBAR_TRIGGER.includes("hover:text-foreground")).toBe(true);

    expect(WORK_TOOLBAR_TRIGGER_IDLE.includes("hover:text-foreground")).toBe(true);
    expect(WORK_TOOLBAR_TRIGGER_FILTER_IDLE.includes("hover:text-foreground")).toBe(true);
    expect(WORK_TOOLBAR_TRIGGER_FILTER_ACTIVE.includes("hover:text-primary")).toBe(true);
  });

  it("renders ModuleFiltersMenuTrigger with accessible hover contrast in idle state", () => {
    const html = renderToStaticMarkup(<ModuleFiltersMenuTrigger label="Filters" activeCount={0} />);
    expect(html.includes("Filters")).toBe(true);
    expect(html.includes("hover:bg-muted")).toBe(true);
    expect(html.includes("hover:text-foreground")).toBe(true);
    expect(html.includes("hover:text-accent-foreground")).toBe(false);
  });

  it("renders ModuleFiltersMenuTrigger with accessible hover contrast in active state", () => {
    const html = renderToStaticMarkup(<ModuleFiltersMenuTrigger label="Filters" activeCount={3} />);
    expect(html.includes("Filters")).toBe(true);
    expect(html.includes("3")).toBe(true);
    expect(html.includes("hover:text-primary")).toBe(true);
    expect(html.includes("hover:bg-primary/5")).toBe(true);
    expect(html.includes("hover:text-accent-foreground")).toBe(false);
  });

  it("verifies zero buttons in frontend use hover:text-accent-foreground with light hover surfaces", () => {
    const srcDir = path.resolve(__dirname, "..");
    const violations: string[] = [];

    function scan(dir: string): void {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.isDirectory()) {
          if (!["node_modules", "dist", "coverage", "__tests__"].includes(entry.name)) {
            scan(path.join(dir, entry.name));
          }
        } else if (/\.(tsx|jsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
          const filePath = path.join(dir, entry.name);
          const content = fs.readFileSync(filePath, "utf8");
          if (!content.includes("<Button")) continue;

          const buttonRegex = /<Button\b([^>]*?)>/gs;
          let match: RegExpExecArray | null;
          while ((match = buttonRegex.exec(content)) !== null) {
            const attrs = match[1];
            // If explicit hover:text-accent-foreground is used alongside light hover:bg-
            if (
              attrs.includes("hover:text-accent-foreground") &&
              (attrs.includes("hover:bg-muted") ||
                attrs.includes("hover:bg-card") ||
                attrs.includes("hover:bg-background"))
            ) {
              const line = content.substring(0, match.index).split("\n").length;
              violations.push(`${path.relative(srcDir, filePath)}:${line}`);
            }
          }
        }
      }
    }

    scan(srcDir);
    expect(violations).toEqual([]);
  });
});
