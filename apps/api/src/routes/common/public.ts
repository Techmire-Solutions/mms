import type { FastifyInstance, FastifyPluginOptions, FastifyRequest } from "fastify";
import { PLATFORM_BRANDING_NAME_FALLBACK, resolveAppDomainForRequest } from "@mms/contracts";
import { requestHostname } from "../../lib/requestHost.js";
import { getPublicPlatformBrandingData } from "@mms/mod-platform/backend/platform/services";

function manifestIcons(
  logoUrl: string,
  faviconUrl: string,
): Array<{
  src: string;
  sizes: string;
  type: string;
}> {
  const custom = logoUrl.trim() || faviconUrl.trim();
  if (custom) {
    return [
      { src: custom, sizes: "any", type: custom.endsWith(".svg") ? "image/svg+xml" : "image/webp" },
    ];
  }
  return [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
  ];
}

export default async function publicRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  fastify.get("/deployment-config", async (request, reply) => {
    const hostname = requestHostname(
      request as FastifyRequest & { headers: Record<string, unknown> },
    );
    const configured = process.env.MMS_APP_DOMAIN?.trim();
    const appDomain = resolveAppDomainForRequest(hostname, configured);
    return reply.send({ appDomain });
  });

  fastify.get("/platform-branding", async (_request, reply) => {
    const data = getPublicPlatformBrandingData();
    const etag = `"${data.updatedAt ?? "default"}-${data.branding.primaryColor}"`;
    reply.header("Cache-Control", "public, no-cache");
    reply.header("ETag", etag);
    return reply.send(data);
  });

  fastify.get("/platform-manifest.webmanifest", async (_request, reply) => {
    const { branding } = getPublicPlatformBrandingData();
    const name = branding.productName.trim() || PLATFORM_BRANDING_NAME_FALLBACK;
    const manifest = {
      name,
      short_name: (branding.productName.trim() || "MMS").slice(0, 12),
      icons: manifestIcons(branding.logoUrl, branding.faviconUrl),
      theme_color: branding.primaryColor,
      background_color: branding.primaryColor,
      display: "standalone",
    };
    reply.header("Cache-Control", "public, no-cache");
    return reply.type("application/manifest+json").send(manifest);
  });
}
