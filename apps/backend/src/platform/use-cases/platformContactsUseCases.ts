import { HttpDomainError } from "../../lib/httpErrors.js";
import { platformContactsRepository } from "../repository/platformContactsAdapter.js";

export interface PlatformContactsUseCases {
  list(input: {
    search?: string;
    kind?: string;
    limit: number;
    offset: number;
  }): ReturnType<typeof platformContactsRepository.list>;
  get(id: string): ReturnType<typeof platformContactsRepository.get>;
  create(
    actor: { id: string; email: string },
    input: Parameters<typeof platformContactsRepository.create>[0],
  ): ReturnType<typeof platformContactsRepository.create>;
  update(
    actor: { id: string; email: string },
    id: string,
    input: Parameters<typeof platformContactsRepository.update>[1],
  ): Promise<NonNullable<Awaited<ReturnType<typeof platformContactsRepository.update>>>>;
  softDelete(actor: { id: string; email: string }, id: string): Promise<void>;
  metrics(): ReturnType<typeof platformContactsRepository.metrics>;
}

async function updateContact(
  actor: { id: string; email: string },
  id: string,
  input: Parameters<typeof platformContactsRepository.update>[1],
): Promise<NonNullable<Awaited<ReturnType<typeof platformContactsRepository.update>>>> {
  const updated = await platformContactsRepository.update(id, input);
  if (!updated) throw new HttpDomainError(404, "not_found", "Platform contact not found");
  await platformContactsRepository.insertActivityLog({
    userId: actor.id,
    userEmail: actor.email,
    action: "platform_contact.update",
    targetResource: "platform_contacts",
    targetId: id,
  });
  return updated;
}

async function deleteContact(actor: { id: string; email: string }, id: string): Promise<void> {
  if (!(await platformContactsRepository.softDelete(id))) {
    throw new HttpDomainError(404, "not_found", "Platform contact not found");
  }
  await platformContactsRepository.insertActivityLog({
    userId: actor.id,
    userEmail: actor.email,
    action: "platform_contact.delete",
    targetResource: "platform_contacts",
    targetId: id,
  });
}

export const platformContactsUseCases: PlatformContactsUseCases = {
  list: (input) => platformContactsRepository.list(input),
  get: (id) => platformContactsRepository.get(id),
  create: (actor, input) => {
    void platformContactsRepository.insertActivityLog({
      userId: actor.id,
      userEmail: actor.email,
      action: "platform_contact.create",
      targetResource: "platform_contacts",
      metadataMessage: input.name,
    });
    return platformContactsRepository.create(input);
  },
  update: updateContact,
  softDelete: deleteContact,
  metrics: () => platformContactsRepository.metrics(),
};
