import {
  registrationLinkWriteSchema,
  type RegistrationLink,
  type RegistrationLinkWrite,
} from "@mms/shared";
import { sessionsAcademicRepository as repo } from "../repository/sessionsAcademicRepositoryAdapter.js";
import { broadcastCollection } from "../../lib/livePush.js";
import { NotFoundError, ValidationError } from "../../lib/httpErrors.js";

/** Live-push key: Sessions detail + Enrollments admissions refetch link lists. */
export const REGISTRATION_LINKS_BROADCAST_KEY = "registration_links";

async function requireSession(tenant: string, sessionId: string) {
  const session = await repo.findSessionById(tenant, sessionId);
  if (!session || session.deletedAt) throw new NotFoundError("Session not found");
  return session;
}

export function createRegistrationLinkUseCases() {
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
      if (removed) await broadcastCollection(REGISTRATION_LINKS_BROADCAST_KEY);
      return removed;
    },
  };
}

export const registrationLinkUseCases = createRegistrationLinkUseCases();
