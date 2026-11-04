import type { FastifyPluginAsync } from "fastify";
import type { User } from "@mms/shared";
import {
  clearContactGoogleSyncConfig,
  clearGoogleSyncTokens,
  exchangeGoogleContactsOAuthCode,
  getContactGoogleSyncConfig,
  GoogleOAuthExchangeError,
  GoogleSyncError,
  redactGoogleSyncConfigForClient,
  runGoogleContactsSync,
  setContactGoogleSyncConfig,
} from "../../../contacts/use-cases/contactGoogleSyncUseCases.js";
import {
  contactGoogleSyncAuditSchema,
  contactGoogleSyncConfigSchema,
  contactGoogleSyncExchangeSchema,
} from "@mms/shared";
import { sendDatabaseError } from "../../../lib/httpErrors.js";
import { parseRequest, replyValidationError } from "../../../lib/zodRequest.js";
import { auditContact, requireContactPermission } from "./contactRouteHelpers.js";

export const contactGoogleSyncRoutes: FastifyPluginAsync = async (fastify) => {
  fastify.get("/google-sync", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "write")) return;
    try {
      const config = await getContactGoogleSyncConfig(String(user.id));
      return reply.send({ config: redactGoogleSyncConfigForClient(config) });
    } catch (error) {
      return sendDatabaseError(reply, "Failed to load Google sync config", error);
    }
  });

  fastify.put("/google-sync", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "write")) return;
    const parsed = parseRequest(contactGoogleSyncConfigSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const existing = await getContactGoogleSyncConfig(String(user.id));
      const { clearTokens, ...updates } = parsed.data;
      const merged = {
        ...existing,
        ...updates,
        clientSecret: updates.clientSecret ?? existing.clientSecret,
        refreshToken: updates.refreshToken ?? existing.refreshToken,
      };
      if (clearTokens) {
        merged.accessToken = undefined;
        merged.refreshToken = undefined;
      }
      const saved = await setContactGoogleSyncConfig(String(user.id), merged);
      await auditContact(
        user,
        "contact.google_sync.update",
        "Updated Google Contacts sync credentials",
        "google-sync",
      );
      return reply.send({ config: redactGoogleSyncConfigForClient(saved) });
    } catch (error) {
      return sendDatabaseError(reply, "Failed to save Google sync config", error);
    }
  });

  fastify.delete("/google-sync", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "write")) return;
    try {
      await clearContactGoogleSyncConfig(String(user.id));
      await auditContact(
        user,
        "contact.google_sync.clear",
        "Disconnected Google Contacts sync",
        "google-sync",
      );
      return reply.send({ success: true });
    } catch (error) {
      return sendDatabaseError(reply, "Failed to clear Google sync config", error);
    }
  });

  fastify.post("/google-sync/exchange", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "write")) return;
    const parsed = parseRequest(contactGoogleSyncExchangeSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    try {
      const config = await exchangeGoogleContactsOAuthCode(
        String(user.id),
        parsed.data.code,
        parsed.data.redirectUri,
        parsed.data.codeVerifier,
      );
      await auditContact(
        user,
        "contact.google_sync.oauth_connected",
        "Google account connected via OAuth",
        "google-sync",
      );
      return reply.send({ config });
    } catch (error) {
      if (error instanceof GoogleOAuthExchangeError) {
        return reply.status(400).send({ type: "oauth_error", message: error.message });
      }
      return sendDatabaseError(reply, "Failed to exchange OAuth code", error);
    }
  });

  fastify.post("/google-sync/run", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "write")) return;
    try {
      const result = await runGoogleContactsSync(String(user.id));
      await auditContact(
        user,
        "contact.google_sync.sync_complete",
        `Google sync · total ${result.total} · imported ${result.imported} · skipped ${result.skipped}`,
        "google-sync",
      );
      return reply.send(result);
    } catch (error) {
      if (error instanceof GoogleSyncError) {
        if (error.code === "session_expired") {
          await clearGoogleSyncTokens(String(user.id));
        }
        return reply.status(400).send({ type: error.code, message: error.message });
      }
      return sendDatabaseError(reply, "Failed to sync Google contacts", error);
    }
  });

  fastify.post("/google-sync/audit", async (request, reply) => {
    const user = request.user as User;
    if (!requireContactPermission(reply, user, "write")) return;
    const parsed = parseRequest(contactGoogleSyncAuditSchema, request.body);
    if (!parsed.ok) return replyValidationError(reply, parsed.message);
    const { action } = parsed.data;
    await auditContact(
      user,
      `contact.google_sync.${action}`,
      action.replace(/_/g, " "),
      "google-sync",
    );
    return reply.send({ success: true });
  });
};
