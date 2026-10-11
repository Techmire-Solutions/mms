import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const apexRoutesPath = join(process.cwd(), "src/platform/routes/ApexRoutes.tsx");
const platformNavPath = join(process.cwd(), "src/platform/lib/platformNav.ts");

describe("platform apex live IA", () => {
  it("given ApexRoutes, should mount dedicated sidebar pages and not import PlatformConsole", () => {
    // Arrange
    const routesSource = readFileSync(apexRoutesPath, "utf8");
    const navSource = readFileSync(platformNavPath, "utf8");

    // Assert — live multi-route IA (sidebar SSOT)
    expect(routesSource).toContain("PlatformDashboardPage");
    expect(routesSource).toContain("PlatformWorkspacesPage");
    expect(routesSource).toContain("PlatformUsersPage");
    expect(routesSource).toContain("PlatformReportsPage");
    expect(routesSource).toContain("PlatformSettingsPage");
    expect(routesSource).toContain("PlatformSystemPage");
    expect(routesSource).toContain("PlatformActivityLogsPage");
    expect(routesSource).toContain("PlatformErdPage");
    expect(routesSource).toContain("PlatformDesignSystemPage");
    expect(routesSource).toContain("PlatformAccount");
    expect(routesSource).toContain("Navigate to={ROUTES.platformUsers}");

    // Assert — orphaned 3-tier console must stay unmounted
    expect(routesSource).not.toContain("PlatformConsole");
    expect(navSource).toContain("ROUTES.platformDashboard");
    expect(navSource).toContain("ROUTES.platformWorkspaces");
    expect(navSource).toContain("ROUTES.platformDesignSystem");
    expect(navSource).toContain('section: "overview"');
    expect(navSource).toContain('section: "access"');
    expect(navSource).toContain('section: "ops"');
  });
});
