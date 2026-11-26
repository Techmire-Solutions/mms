import type { PlatformUser, User } from "@mms/contracts";

declare module "fastify" {
  interface FastifyRequest {
    user?: User & {
      twoFactorVerified?: boolean;
      tokenType?: string;
      jti?: string;
      iat?: number;
      iat_ms?: number;
      exp?: number;
    };
    tenant?: { id: string };
    platformUser?: PlatformUser;
  }
}
