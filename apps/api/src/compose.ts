/**
 * @file compose.ts
 * @description Composition root for module REST surfaces (P7).
 *
 * Module contracts declare absolute `/api/<m>/…` paths, so the canonical
 * `/api/tenant/<m>/…` mount is produced with an `onRoute` alias hook rather than
 * a second plugin registration (which would double-nest). The legacy mount keeps
 * working and gains `Deprecation` + `Sunset`.
 */
import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyPluginOptions,
  RouteOptions,
} from "fastify";
import {
  moduleRoutePrefixes,
  toCanonicalUrl,
  LEGACY_DEPRECATION_HEADER,
  LEGACY_SUNSET_HEADER,
  LEGACY_MOUNT_SUNSET,
} from "@mms/contracts/routing";
import { authenticateTenant } from "./middleware/authenticate.js";
import { registerModuleAccess } from "./middleware/requireTenantModule.js";

export interface ModuleRouteDescriptor {
  /** Access key for `registerModuleAccess` (tenant surfaces). */
  readonly moduleKey: string;
  /** Manifest REST base path, e.g. `/api/students`. */
  readonly restBasePath: string;
  /** Fastify plugin owning the module's routes. */
  readonly register: FastifyPluginAsync<FastifyPluginOptions>;
  readonly options?: Record<string, unknown>;
}

export function descriptorPrefixes(descriptor: ModuleRouteDescriptor) {
  return moduleRoutePrefixes(descriptor.restBasePath);
}

export function assertDescriptorShape(descriptor: ModuleRouteDescriptor): void {
  if (!descriptor.moduleKey) throw new Error("module descriptor is missing moduleKey");
  if (!descriptor.restBasePath.startsWith("/api/")) {
    throw new Error(
      `module descriptor '${descriptor.moduleKey}' has a non-/api/ restBasePath: ${descriptor.restBasePath}`,
    );
  }
}

/**
 * Register a module once (legacy paths) and expose every route again under the
 * canonical `/api/tenant/<m>` prefix via an `onRoute` alias.
 */
export async function mountModuleDescriptor(
  app: FastifyInstance,
  descriptor: ModuleRouteDescriptor,
): Promise<void> {
  assertDescriptorShape(descriptor);
  const { canonical, legacy } = descriptorPrefixes(descriptor);

  await app.register(async (scope) => {
    // Tenant surfaces are module-access gated exactly like the app-level kernel
    // routes; the descriptor's `moduleKey` is the access key.
    scope.addHook("preHandler", authenticateTenant);
    registerModuleAccess(scope, descriptor.moduleKey);

    scope.addHook("onSend", async (request, reply, payload) => {
      // Only the legacy `/api/<m>` URLs are deprecated; the canonical
      // `/api/tenant/<m>` aliases must not advertise a sunset.
      const path = request.url.split("?")[0] ?? "/";
      if (!path.startsWith("/api/tenant/")) {
        reply.header(LEGACY_DEPRECATION_HEADER, "true");
        reply.header(LEGACY_SUNSET_HEADER, LEGACY_MOUNT_SUNSET);
      }
      return payload;
    });

    // The module routers register both the legacy (`/api/<m>`) and the canonical
    // (`/api/tenant/<m>`) prefixes themselves for deploy parity. Collect legacy
    // routes during registration, then alias only the canonical URLs the module
    // did not already declare — an eager alias would collide with the module's
    // own canonical registration ("Method 'GET' already declared").
    let aliasing = false;
    const pending: Array<{ routeOptions: RouteOptions; canonicalUrl: string }> = [];
    const seen = new Set<string>();
    scope.addHook("onRoute", (routeOptions: RouteOptions) => {
      if (aliasing) return;
      // Fastify auto-exposes HEAD for every GET; the aliased GET brings its own.
      const methods = Array.isArray(routeOptions.method)
        ? routeOptions.method
        : [routeOptions.method];
      if (methods.length === 1 && methods[0] === "HEAD") return;
      const canonicalUrl = toCanonicalUrl(routeOptions.url, descriptor.restBasePath);
      if (!canonicalUrl) return;
      const key = `${String(routeOptions.method)}|${canonicalUrl}`;
      if (seen.has(key)) return;
      seen.add(key);
      pending.push({ routeOptions, canonicalUrl });
    });

    await scope.register(descriptor.register, descriptor.options ?? {});

    for (const { routeOptions, canonicalUrl } of pending) {
      const method = Array.isArray(routeOptions.method)
        ? routeOptions.method[0]
        : routeOptions.method;
      let exists: boolean;
      try {
        exists = scope.hasRoute({ method, url: canonicalUrl });
      } catch {
        exists = false;
      }
      if (exists) continue;
      aliasing = true;
      try {
        scope.route({ ...routeOptions, url: canonicalUrl });
      } finally {
        aliasing = false;
      }
    }
  });

  void canonical;
  void legacy;
}
