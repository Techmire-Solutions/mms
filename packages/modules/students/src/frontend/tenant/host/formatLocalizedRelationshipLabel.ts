import { getStudentsHost } from "../host.js";

export function formatLocalizedRelationshipLabel(...args: any[]): string {
  return (getStudentsHost() as any).formatLocalizedRelationshipLabel(...args);
}

export function formatLocalizedRelationshipParts(...args: any[]): any {
  return (getStudentsHost() as any).formatLocalizedRelationshipParts(...args);
}
