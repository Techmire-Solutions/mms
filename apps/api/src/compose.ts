/**
 * @file compose.ts
 * @description Single composition root for module-owned REST surfaces (P7).
 *
 * Each module package contributes a descriptor; `routes/index.ts` mounts every
 * descriptor twice — canonical `/api/tenant/<m>` and legacy `/api/<m>` (the
 * legacy mount carries `Deprecation` + `Sunset`).
 */
import type {
  FastifyInstance,
  FastifyPluginAsync,
  FastifyPluginOptions,
  preHandlerAsyncHookHandler,
} from "fastify";
import {
  moduleRoutePrefixes,
  LEGACY_DEPRECATION_HEADER,
  LEGACY_SUNSET_HEADER,
  LEGACY_MOUNT_SUNSET,
} from "@mms/contracts/routing";

export type ModuleAudience = "tenant" | "platform";

export interface ModuleRouteDescriptor {
  /** Access key for `registerModuleAccess` (tenant surfaces). */
  readonly moduleKey: string;
  /** Historical manifest path, e.g. `/api/contacts`. */
  readonly restBasePath: string;
  readonly audience: ModuleAudience;
  /** Platform permission for platform surfaces. */
  readonly platformPermission?: string;
  /** Fastify plugin owning the module's routes. */
  readonly register: FastifyPluginAsync<FastifyPluginOptions>;
  readonly options?: Record<string, unknown>;
}

export interface MountContext {
  readonly authenticateTenant: preHandlerAsyncHookHandler;
  readonly authenticatePlatform: preHandlerAsyncHookHandler;
  readonly requirePlatformPermission: (permission: string) => preHandlerAsyncHookHandler;
  readonly registerModuleAccess: (scope: FastifyInstance, moduleKey: string) => void;
}

/** Derive both mount prefixes for a descriptor. */
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
 * Mount a descriptor on the canonical prefix and the legacy prefix.
 * The legacy mount adds the RFC 9745 / RFC 8594 headers.
 */
export async function mountModuleDescriptor(
  app: FastifyInstance,
  descriptor: ModuleRouteDescriptor,
  ctx: MountContext,
): Promise<void> {
  assertDescriptorShape(descriptor);
  const { canonical, legacy } = descriptorPrefixes(descriptor);

  const registerScoped = async (scope: FastifyInstance): Promise<void> => {
    if (descriptor.audience === "tenant") {
      scope.addHook("preHandler", ctx.authenticateTenant);
      ctx.registerModuleAccess(scope, descriptor.moduleKey);
    } else {
      scope.addHook("preHandler", ctx.authenticatePlatform);
      if (descriptor.platformPermission) {
        scope.addHook("preHandler", ctx.requirePlatformPermission(descriptor.platformPermission));
      }
    }
    await scope.register(descriptor.register, descriptor.options as never);
  };

  await app.register(
    async (scope) => {
      scope.addHook("onSend", async (_request, reply, payload) => {
        reply.header(LEGACY_DEPRECATION_HEADER, "true");
        reply.header(LEGACY_SUNSET_HEADER, LEGACY_MOUNT_SUNSET);
        return payload;
      });
      await registerScoped(scope);
    },
    { prefix: legacy },
  );

  await app.register(registerScoped as never, { prefix: canonical });
}
