import type { FastifyPluginAsync } from "fastify";
import {
  CONTACT_PICKER_DEFAULT_RESULTS,
  type Contact,
  type ContactPickerOption,
  contactsPickerContract,
  getDisplayName,
  getPrimaryAddress,
  getPrimaryEmail,
  getPrimaryPhone,
  isQueryFlagTrue,
  type User,
} from "@mms/shared";
import { initServer, type RouterImplementation } from "@ts-rest/fastify";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { replyValidationError } from "../../../lib/zodRequest.js";
import { contactUseCases } from "../../../contacts/use-cases/contactUseCases.js";
import { canUseContactPicker } from "../../../services/rbacService.js";
import { sanitizeForUser, sanitizeOneForUser } from "./contactRouteHelpers.js";

/** Bounds the `excludeIds` list so a picker cannot force an unbounded id scan. */
const CONTACT_PICKER_MAX_EXCLUDE_IDS = 100;

const s = initServer();

function forbidden() {
  return {
    status: 403 as const,
    body: { type: "forbidden", message: "Insufficient permissions" },
  };
}

function trimmedOrUndefined(value: string | null | undefined): string | undefined {
  const text = value?.trim();
  return text ? text : undefined;
}

/** Parses the comma-separated picker `excludeIds` query into a capped, deduped id list. */
export function parseContactPickerExcludeIds(raw?: string): string[] {
  if (!raw) return [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (!id) continue;
    seen.add(id);
    if (seen.size >= CONTACT_PICKER_MAX_EXCLUDE_IDS) break;
  }
  return [...seen];
}

/**
 * Projects a sanitized Contact onto the lean picker shape. Everything outside
 * `contactPickerOptionSchema` is dropped here, after field-config sanitization,
 * so restricted phone/email/city values can never leak through the picker.
 */
export function toContactPickerOption(contact: Contact): ContactPickerOption {
  const option: ContactPickerOption = {
    id: String(contact.id),
    name: getDisplayName(contact),
    phone: getPrimaryPhone(contact) ?? "",
  };
  const email = trimmedOrUndefined(getPrimaryEmail(contact));
  if (email) option.email = email;
  const city = trimmedOrUndefined(getPrimaryAddress(contact)?.city);
  if (city) option.city = city;
  return option;
}

export const contactPickerRoutes: FastifyPluginAsync = async (fastify) => {
  const router = s.router(contactsPickerContract, {
    search: async ({
      query,
      request,
    }: ContractRouteArgs<(typeof contactsPickerContract)["search"]>): Promise<
      ContractRouteResponse<(typeof contactsPickerContract)["search"]>
    > => {
      const user = request.user as User;
      if (!canUseContactPicker(user)) return forbidden();
      try {
        const result = await contactUseCases.loadContactsPage({
          page: 1,
          limit: query.limit ?? CONTACT_PICKER_DEFAULT_RESULTS,
          search: query.search,
          gender: query.gender,
          hasPhone: isQueryFlagTrue(query.hasPhone),
          excludeIds: parseContactPickerExcludeIds(query.excludeIds),
        });
        const sanitized = await sanitizeForUser(result.contacts, user);
        return {
          status: 200 as const,
          body: { contacts: sanitized.map(toContactPickerOption) },
        };
      } catch (error) {
        request.log.error(error, "Failed to search contacts for picker");
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to search contacts" },
        };
      }
    },
    get: async ({
      params: { id },
      request,
    }: ContractRouteArgs<(typeof contactsPickerContract)["get"]>): Promise<
      ContractRouteResponse<(typeof contactsPickerContract)["get"]>
    > => {
      const user = request.user as User;
      if (!canUseContactPicker(user)) return forbidden();
      try {
        const contact = await contactUseCases.getContactById(id, false);
        if (!contact) {
          return {
            status: 404 as const,
            body: { type: "not_found", message: "Contact not found" },
          };
        }
        const sanitized = await sanitizeOneForUser(contact, user);
        return { status: 200 as const, body: { contact: toContactPickerOption(sanitized) } };
      } catch (error) {
        request.log.error(error, "Failed to resolve contact for picker");
        return {
          status: 500 as const,
          body: { type: "database_error", message: "Failed to resolve contact" },
        };
      }
    },
  } as unknown as RouterImplementation<typeof contactsPickerContract>);

  await fastify.register(s.plugin(router), {
    requestValidationErrorHandler: (err, _request, reply) => {
      const zErr = err.body ?? err.query ?? err.pathParams ?? err.headers;
      const message = zErr instanceof Error ? zErr.message : err.message;
      void replyValidationError(reply, message);
    },
  });
};
