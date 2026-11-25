import {
  registrationLinkWriteSchema,
  type RegistrationLink,
  type RegistrationLinkWrite,
} from "@mms/contracts";
import { sessionsAcademicRepository as repo } from "../repository/sessionsAcademicRepositoryAdapter.js";
import { broadcastCollection } from "@mms/be-core/realtime";
import { invalidateMultiTierCache } from "@mms/be-core/cache";
import { NotFoundError, ValidationError } from "@mms/be-core/http/errors";

/** Live-push key: Sessions detail + Enrollments admissions refetch link lists. */
const REGISTRATION_LINKS_BROADCAST_KEY = "registration_links";

async function requireSession(tenant: string, sessionId: string) {
  const session = await repo.findSessionById(tenant, sessionId);
  if (!session || session.deletedAt) throw new NotFoundError("Session not found");
  return session;
}

function createRegistrationLinkUseCases() {
  return {
    async list(tenant: string, sessionId: string): Promise<RegistrationLink[]> {
      await requireSession(tenant, sessionId);
      return repo.listRegistrationLinks(tenant, sessionId);
    },

    async save(
      tenant: string,
      sessionId: string,
      id: string,
      body: RegistrationLinkWrite,
      actorUserId: string,
    ): Promise<RegistrationLink> {
      const parsed = registrationLinkWriteSchema.parse(body);
      if (parsed.opensAt && parsed.closesAt && parsed.closesAt <= parsed.opensAt)
        throw new ValidationError("The registration link must close after it opens");
      if (parsed.maxSubmissions !== null && parsed.maxSubmissions < 1)
        throw new ValidationError("Maximum submissions must be at least 1");
      const session = await requireSession(tenant, sessionId);
      const sessionClassIds = new Set(session.classes.map((cls) => cls.id));
      const foreign = parsed.classIds.filter((classId) => !sessionClassIds.has(classId));
      if (foreign.length > 0)
        throw new ValidationError("Every class on the link must belong to this session");
      const link = await repo.saveRegistrationLink(tenant, {
        id,
        sessionId,
        ...parsed,
        actorUserId,
      });
      await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
      await broadcastCollection(REGISTRATION_LINKS_BROADCAST_KEY);
      return link;
    },

    async remove(
      tenant: string,
      sessionId: string,
      id: string,
      actorUserId: string,
    ): Promise<boolean> {
      const removed = await repo.softDeleteRegistrationLink(tenant, sessionId, id, actorUserId);
      if (removed) {
        await invalidateMultiTierCache({ tenantId: tenant, domain: "sessions" });
        await broadcastCollection(REGISTRATION_LINKS_BROADCAST_KEY);
      }
      return removed;
    },
  };
}

export const registrationLinkUseCases = createRegistrationLinkUseCases();
