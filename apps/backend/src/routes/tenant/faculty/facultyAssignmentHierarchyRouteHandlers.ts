import { canReadCollection } from "../../../services/rbacService.js";
import type { User, facultyContract } from "@mms/shared";
import type { ContractRouteArgs, ContractRouteResponse } from "../../../lib/contractRouterTypes.js";
import { findFacultyAssignmentById } from "../../../db/repositories/facultyAssignmentRepository.js";
import {
  findAssignmentSubordinateTree,
  findAssignmentManagerChain,
} from "../../../db/repositories/facultyAssignmentHierarchyRepository.js";

export async function handleGetSubordinates({
  params: { id },
  request,
}: ContractRouteArgs<(typeof facultyContract)["getAssignmentSubordinates"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["getAssignmentSubordinates"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, "faculty")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const tenantId = request.tenant?.id;
  if (!tenantId) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Tenant context required" },
    };
  }
  try {
    const existing = await findFacultyAssignmentById(String(tenantId), id);
    if (!existing) {
      return { status: 404 as const, body: { type: "not_found", message: "Assignment not found" } };
    }
    const tree = await findAssignmentSubordinateTree(String(tenantId), id);
    return { status: 200 as const, body: { tree: tree } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to retrieve assignment subordinates" },
    };
  }
}

export async function handleGetManagers({
  params: { id },
  request,
}: ContractRouteArgs<(typeof facultyContract)["getAssignmentManagerChain"]>): Promise<
  ContractRouteResponse<(typeof facultyContract)["getAssignmentManagerChain"]>
> {
  const user = request.user as User;
  if (!canReadCollection(user, "faculty")) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Insufficient permissions" },
    };
  }
  const tenantId = request.tenant?.id;
  if (!tenantId) {
    return {
      status: 403 as const,
      body: { type: "forbidden", message: "Tenant context required" },
    };
  }
  try {
    const existing = await findFacultyAssignmentById(String(tenantId), id);
    if (!existing) {
      return { status: 404 as const, body: { type: "not_found", message: "Assignment not found" } };
    }
    const chain = await findAssignmentManagerChain(String(tenantId), id);
    return { status: 200 as const, body: { chain: chain } };
  } catch {
    return {
      status: 500 as const,
      body: { type: "server_error", message: "Failed to retrieve assignment manager chain" },
    };
  }
}
