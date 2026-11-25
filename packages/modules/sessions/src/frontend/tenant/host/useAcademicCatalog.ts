import { getSessionsHost } from "../host.js";

export function useAcademicCatalog(...args: any[]): any {
  return (getSessionsHost() as any).useAcademicCatalog(...args);
}

export function useAcademicCatalogActions(...args: any[]): any {
  return (getSessionsHost() as any).useAcademicCatalogActions?.(...args);
}

export function useAcademicCatalogItems(...args: any[]): any {
  return (getSessionsHost() as any).useAcademicCatalogItems?.(...args);
}

export function useExaminationSubjects(...args: any[]): any {
  return (getSessionsHost() as any).useExaminationSubjects?.(...args);
}
