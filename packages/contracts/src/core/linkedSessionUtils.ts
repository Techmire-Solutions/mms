import {
  createNamedEntityLookupMap,
  normalizeIdLinkedName,
  resolveEntityName,
  type NamedEntity,
} from "../contacts/contactLinkPolicy.js";

export interface SessionClassLike extends Record<string, unknown> {
  id?: string;
  facultyId?: string;
  facultyName?: string;
}

export interface SessionLike extends Record<string, unknown> {
  classes?: SessionClassLike[];
}

export function normalizeSessionClasses(classes: SessionClassLike[]): SessionClassLike[] {
  if (!classes || !Array.isArray(classes)) return [];
  return classes.map((cls) => {
    if (!cls || typeof cls !== "object") return cls;
    return normalizeIdLinkedName(cls, "facultyId", "facultyName");
  });
}

export function hydrateSessionClasses(
  classes: SessionClassLike[],
  faculty: NamedEntity[] | Map<string, NamedEntity>,
): SessionClassLike[] {
  if (!classes || !Array.isArray(classes)) return [];
  const lookup =
    faculty instanceof Map
      ? faculty
      : faculty.length > 8
        ? createNamedEntityLookupMap(faculty)
        : faculty;
  let hasChanges = false;
  const mapped = classes.map((cls) => {
    if (!cls || typeof cls !== "object") return cls;
    const current = cls.facultyName;
    const resolved = resolveEntityName(cls.facultyId, lookup) || current;
    if (resolved === current) return cls;
    hasChanges = true;
    return {
      ...cls,
      facultyName: resolved,
    };
  });
  return hasChanges ? mapped : classes;
}

export function normalizeSessionsCollection(sessions: SessionLike[]): SessionLike[] {
  if (!sessions || !Array.isArray(sessions)) return [];
  return sessions.map((session) => {
    if (!session || typeof session !== "object") return session;
    if (!Array.isArray(session.classes)) return session;
    return { ...session, classes: normalizeSessionClasses(session.classes) };
  });
}

export function hydrateSessionsCollection(
  sessions: SessionLike[],
  faculty: NamedEntity[] | Map<string, NamedEntity>,
): SessionLike[] {
  if (!sessions || !Array.isArray(sessions)) return [];
  const lookup =
    faculty instanceof Map
      ? faculty
      : faculty.length > 8
        ? createNamedEntityLookupMap(faculty)
        : faculty;
  return sessions.map((session) => {
    if (!session || typeof session !== "object") return session;
    if (!Array.isArray(session.classes)) return session;
    const nextClasses = hydrateSessionClasses(session.classes, lookup);
    if (nextClasses === session.classes) return session;
    return { ...session, classes: nextClasses };
  });
}
