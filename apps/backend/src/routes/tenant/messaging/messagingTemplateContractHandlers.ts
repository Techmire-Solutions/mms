import { randomUUID } from "node:crypto";
import type { MessageTemplate, User } from "@mms/shared";
import { messageTemplateInputSchema, type messagingContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { canReadMessaging, canWriteMessaging } from "../../../services/rbacService.js";
import { withTenant } from "../../../db/tenant-context.js";
import { getRequestTenant } from "../../../lib/tenantContext.js";
import { messagingUseCases } from "../../../messaging/use-cases/messagingUseCases.js";
import {
  collectUnknownPersonalizationTokens,
  formatUnknownTokensMessage,
} from "./messagingPersonalizationGuard.js";

function getTenantSubdomain(request: { tenant?: { id?: string; subdomain?: string } }): string {
  const subdomain = getRequestTenant() || request.tenant?.subdomain;
  if (!subdomain) throw new Error("Tenant context required");
  return String(subdomain);
}

export async function messagingListTemplatesHandler({
  request,
}: ContractRouteArgs<(typeof messagingContract)["listTemplates"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["listTemplates"]>
> {
  const user = request.user as User;
  if (!canReadMessaging(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  try {
    const templates = await withTenant(
      String(request.tenant?.id),
      () => messagingUseCases.loadMessageTemplates(),
      { readOnly: true },
    );
    return { status: 200 as const, body: { templates } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to list templates" },
    };
  }
}

export async function messagingSaveTemplateHandler({
  body,
  request,
}: ContractRouteArgs<(typeof messagingContract)["saveTemplate"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["saveTemplate"]>
> {
  const user = request.user as User;
  if (!canWriteMessaging(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const parsed = messageTemplateInputSchema.safeParse(body);
  if (!parsed.success) {
    return {
      status: 400 as const,
      body: {
        type: "validation_error",
        message: parsed.error.issues[0]?.message ?? "Invalid body",
      },
    };
  }
  const unknownTokens = collectUnknownPersonalizationTokens(parsed.data.body);
  if (unknownTokens.length > 0) {
    return {
      status: 400 as const,
      body: { type: "validation_error", message: formatUnknownTokensMessage(unknownTokens) },
    };
  }

  let tenantSubdomain: string;
  try {
    tenantSubdomain = getTenantSubdomain(request);
  } catch {
    return {
      status: 400 as const,
      body: { type: "validation_error", message: "Tenant context required" },
    };
  }

  const requestedId = parsed.data.id?.trim();
  let templateId: string;
  if (!requestedId) {
    templateId = `custom_${randomUUID()}`;
  } else if (!requestedId.startsWith("custom_")) {
    return {
      status: 400 as const,
      body: { type: "validation_error", message: "System templates cannot be overwritten" },
    };
  } else {
    try {
      const existing = await messagingUseCases.getMessageTemplateById(tenantSubdomain, requestedId);
      if (!existing) {
        return { status: 400 as const, body: { type: "not_found", message: "Template not found" } };
      }
    } catch {
      return {
        status: 500 as const,
        body: { type: "database_error", message: "Failed to load message template" },
      };
    }
    templateId = requestedId;
  }

  const template: MessageTemplate = {
    id: templateId,
    label: parsed.data.label,
    body: parsed.data.body,
    category: parsed.data.category,
    channel: parsed.data.channel,
    updatedAt: new Date().toISOString(),
  };

  try {
    const saved = await messagingUseCases.saveMessageTemplate(tenantSubdomain, template);
    return { status: 200 as const, body: { template: saved } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to save message template" },
    };
  }
}

export async function messagingDeleteTemplateHandler({
  params,
  request,
}: ContractRouteArgs<(typeof messagingContract)["deleteTemplate"]>): Promise<
  ContractRouteResponse<(typeof messagingContract)["deleteTemplate"]>
> {
  const user = request.user as User;
  if (!canWriteMessaging(user)) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  let tenantSubdomain: string;
  try {
    tenantSubdomain = getTenantSubdomain(request);
  } catch {
    return {
      status: 400 as const,
      body: { type: "validation_error", message: "Tenant context required" },
    };
  }

  const id = params?.id?.trim();
  if (!id || !id.startsWith("custom_")) {
    return {
      status: 400 as const,
      body: { type: "validation_error", message: "System templates cannot be deleted" },
    };
  }

  try {
    await messagingUseCases.removeMessageTemplate(tenantSubdomain, id);
    return { status: 200 as const, body: { success: true as const } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "database_error", message: "Failed to delete message template" },
    };
  }
}
