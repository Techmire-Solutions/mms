import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const apexRoutesPath = join(process.cwd(), "src/platform/routes/ApexRoutes.tsx");
const apexRegistryPath = join(process.cwd(), "src/platform/routes/apexRouteRegistry.ts");
const platformNavPath = join(process.cwd(), "src/platform/lib/platformNav.ts");

describe("platform apex live IA", () => {
  it("given the console registry, should mount dedicated sidebar pages and not import PlatformConsole", () => {
    // Arrange — page loaders now live in the registry SSOT (ApexRoutes derives from it)
    const routesSource = readFileSync(apexRoutesPath, "utf8");
    const registrySource = readFileSync(apexRegistryPath, "utf8");
    const navSource = readFileSync(platformNavPath, "utf8");

    // Assert — live multi-route IA (sidebar SSOT)
    expect(registrySource).toContain("PlatformDashboardPage");
    expect(registrySource).toContain("PlatformWorkspacesPage");
    expect(registrySource).toContain("PlatformUsersPage");
    expect(registrySource).toContain("PlatformReportsPage");
    expect(registrySource).toContain("PlatformSettingsPage");
    expect(registrySource).toContain("PlatformSystemPage");
    expect(registrySource).toContain("PlatformActivityLogsPage");
    expect(registrySource).toContain("PlatformErdPage");
    expect(registrySource).toContain("PlatformDesignSystemPage");
    expect(registrySource).toContain("PlatformAccount");
    expect(registrySource).toContain("redirectTo: ROUTES.platformUsers");

    // Assert — ApexRoutes renders the console from the registry
    expect(routesSource).toContain("PLATFORM_CONSOLE_GROUPS");

    // Assert — orphaned 3-tier console must stay unmounted
    expect(routesSource).not.toContain("PlatformConsole");
    expect(registrySource).not.toContain("PlatformConsole");
    expect(navSource).toContain("ROUTES.platformDashboard");
    expect(navSource).toContain("ROUTES.platformWorkspaces");
    expect(navSource).toContain("ROUTES.platformDesignSystem");
    expect(navSource).toContain('section: "overview"');
    expect(navSource).toContain('section: "access"');
    expect(navSource).toContain('section: "ops"');
  });
});
