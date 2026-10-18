# Module Manifest, Routing & Tier Architecture

This guide details the procedure for registering a new module manifest in `@mms/shared`, configuring route-access gates in the frontend, and structuring the three-tier `ModulePageShell`.

---

## 1. Module Manifest Registration (`packages/shared`)

Every module declares a manifest defining its capability flags, settings, and permission keys:

```ts
// packages/shared/src/manifests/myModuleManifest.ts
export interface MyModuleManifest {
  readonly id: "myModule";
  readonly titleKey: "nav.myModule";
  readonly permission: "myModule.view";
  readonly writePermission: "myModule.write";
  readonly reportsPermission: "reports.view";
  readonly setupPermission: "settings.edit";
}

export const MY_MODULE_MANIFEST: MyModuleManifest = {
  id: "myModule",
  titleKey: "nav.myModule",
  permission: "myModule.view",
  writePermission: "myModule.write",
  reportsPermission: "reports.view",
  setupPermission: "settings.edit",
} as const;
```

Export the manifest from `packages/shared/src/index.ts`.

---

## 2. Route Access Classification (`TenantRoutes.tsx`)

Declare the module route under the `ModuleAccessRoute` boundary in `apps/frontend/src/tenant/routes/TenantRoutes.tsx`:

```tsx
// Gated by ModuleAccessRoute
<Route element={<ModuleAccessRoute />}>
  <Route
    path="/my-module"
    element={
      <Suspense fallback={<PageSkeleton />}>
        <MyModulePage />
      </Suspense>
    }
  />
</Route>
```

Add the route path to `TENANT_APP_ROUTE_ACCESS` in `apps/frontend/src/lib/config/routeAccess.ts`:

```ts
"/my-module": {
  module: "myModule",
  requiredPermission: "myModule.view",
},
```

Verify with: `pnpm --filter mms-frontend test src/lib/config/routeAccess.test.ts`.

---

## 3. Module Page Tier Layout (`ModulePageShell`)

The module page coordinates three tiers:
1. **Primary Operational Tier** (Directory / Table & Cards)
2. **Reports Tier** (Analytical charts & KPI cards) — lazy-loaded
3. **Setup Tier** (Preferences & custom fields) — lazy-loaded

```tsx
import { lazy, Suspense } from "react";
import { ModulePageShell } from "@/components/app/ModulePageShell";
import { useFilteredModuleTierTabs } from "@/tenant/hooks/useModuleTierTabs";
import { usePersistedTabState } from "@/hooks/usePersistedTabState";
import { useModulePermissions } from "@/tenant/hooks/usePermissions";
import { MY_MODULE_MANIFEST } from "@mms/shared";
import { MyModuleWorkDirectory } from "./MyModuleWorkDirectory";

const MyModuleReportsTier = lazy(() => import("./MyModuleReportsTier"));
const MyModuleSetupTier = lazy(() => import("./MyModuleSetupTier"));

export function MyModulePage() {
  const { canViewReports, canViewSetup } = useModulePermissions(MY_MODULE_MANIFEST);
  const [activeTab, setActiveTab] = usePersistedTabState("my-module:tier", "work");

  const tabs = useFilteredModuleTierTabs({
    canViewReports,
    canViewSetup,
    workLabelKey: "nav.myModule",
  });

  return (
    <ModulePageShell
      titleKey="nav.myModule"
      tabs={tabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
    >
      {activeTab === "work" && <MyModuleWorkDirectory />}
      {activeTab === "reports" && (
        <Suspense fallback={<TierSkeleton />}>
          <MyModuleReportsTier />
        </Suspense>
      )}
      {activeTab === "setup" && (
        <Suspense fallback={<TierSkeleton />}>
          <MyModuleSetupTier />
        </Suspense>
      )}
    </ModulePageShell>
  );
}
```
