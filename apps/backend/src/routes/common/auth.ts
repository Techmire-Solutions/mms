import { type FastifyInstance, type FastifyPluginOptions } from "fastify";
import { authPasswordOtpRoutes } from "./auth/authPasswordOtpRoutes.js";
import { authLoginRoutes } from "./auth/authLoginRoutes.js";
import { authProfileRoutes } from "./auth/authProfileRoutes.js";
import { authSessionRoutes } from "./auth/authSessionRoutes.js";

export default async function authRoutes(
  fastify: FastifyInstance,
  _options: FastifyPluginOptions,
): Promise<void> {
  await fastify.register(authLoginRoutes);
  await fastify.register(authPasswordOtpRoutes);
  await fastify.register(authProfileRoutes);
  await fastify.register(authSessionRoutes);
}
