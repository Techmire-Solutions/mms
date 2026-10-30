import { describe, expect, it } from "vitest";
import {
  buildModuleAvailability,
  evaluateModuleAccess,
  roleHasPermission,
  type Permission,
} from "@mms/shared";
import { ROUTES } from "@/lib/config/routes";
import { NAV_ITEMS, type NavItem } from "@/lib/config/navConfig";
import { filterSidebarNavItems } from "@/lib/config/navAccess";
import type { ModuleAccessEvaluator } from "@/lib/config/routeAccess";

function evaluator(
  enabledModules: Record<string, boolean>,
  can: (p: Permission) => boolean,
): ModuleAccessEvaluator {
  const availability = buildModuleAvailability(null, enabledModules);
  return (moduleId, action) => evaluateModuleAccess({ moduleId, availability, can, action });
}

function visiblePaths(items: readonly NavItem[]): string[] {
  return items.flatMap((item) => [
    ...(item.path ? [item.path] : []),
    ...(item.subItems?.map((subItem) => subItem.path) ?? []),
  ]);
}

describe("filterSidebarNavItems", () => {
  it("omits administrative, financial, and contacts modules for teachers", () => {
    const items = filterSidebarNavItems(
      NAV_ITEMS,
      evaluator({}, (permission) => roleHasPermission("teacher", permission)),
    );
    const paths = visiblePaths(items);

    expect(paths).toContain(ROUTES.home);
    expect(paths).toContain(ROUTES.students);
    expect(paths).toContain(ROUTES.attendance);
    expect(paths).not.toContain(ROUTES.contacts);
    expect(paths).not.toContain(ROUTES.finance);
    expect(paths).not.toContain(ROUTES.accounting);
    expect(paths).not.toContain(ROUTES.users);
    // Settings itself is visible to every role now — General/Theme are open to
    // everyone; admin-only sections (Institution, AI, Modules, Backup, Notifications/
    // Security) are gated inside the page per-section, not at the sidebar link.
    expect(paths).toContain(ROUTES.settings);
  });

  it("applies the same restrictions to assistant teachers", () => {
    const items = filterSidebarNavItems(
      NAV_ITEMS,
      evaluator({}, (permission) => roleHasPermission("assistant_teacher", permission)),
    );
    const paths = visiblePaths(items);

    expect(paths).not.toContain(ROUTES.contacts);
    expect(paths).not.toContain(ROUTES.finance);
    expect(paths).not.toContain(ROUTES.accounting);
    expect(paths).not.toContain(ROUTES.users);
    expect(paths).toContain(ROUTES.settings);
  });

  it("keeps permitted modules visible for administrators", () => {
    const items = filterSidebarNavItems(
      NAV_ITEMS,
      evaluator({}, (permission) => roleHasPermission("admin", permission)),
    );
    const paths = visiblePaths(items);

    expect(paths).toContain(ROUTES.contacts);
    expect(paths).toContain(ROUTES.finance);
    expect(paths).toContain(ROUTES.accounting);
    expect(paths).toContain(ROUTES.users);
    expect(paths).toContain(ROUTES.settings);
  });

  it("also omits modules disabled in workspace settings", () => {
    const items = filterSidebarNavItems(
      NAV_ITEMS,
      evaluator({ finance: false }, (permission) => roleHasPermission("admin", permission)),
    );

    expect(visiblePaths(items)).not.toContain(ROUTES.finance);
    expect(visiblePaths(items)).toContain(ROUTES.students);
  });

  it("promotes students above the academics group", () => {
    const labels = NAV_ITEMS.map((item) => item.labelKey);
    expect(labels.indexOf("nav.students")).toBe(labels.indexOf("nav.contacts") + 1);

    const academicsItem = NAV_ITEMS.find((item) => item.labelKey === "nav.academics");
    expect(academicsItem).toBeDefined();
    const subItemKeys = academicsItem?.subItems?.map((s) => s.labelKey);
    expect(subItemKeys?.slice(0, 4)).toEqual([
      "nav.sessions",
      "nav.enrollments",
      "nav.attendance",
      "nav.hasanatCards",
    ]);
  });

  it("positions faculty after students and before messaging", () => {
    const labels = NAV_ITEMS.map((item) => item.labelKey);
    const contactsIdx = labels.indexOf("nav.contacts");
    const facultyIdx = labels.indexOf("nav.faculty");
    const messagingIdx = labels.indexOf("nav.messaging");

    expect(contactsIdx).toBeGreaterThan(-1);
    expect(facultyIdx).toBe(contactsIdx + 2);
    expect(messagingIdx).toBe(facultyIdx + 1);

    const facultyItem = NAV_ITEMS[facultyIdx];
    expect(facultyItem?.path).toBe(ROUTES.faculty);
    expect(facultyItem?.subItems).toBeUndefined();
  });
});
