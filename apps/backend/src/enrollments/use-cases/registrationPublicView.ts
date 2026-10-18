import {
  normalizeSessionStatus,
  remainingSeats,
  SESSION_ENROLLABLE_STATES,
  type Class,
  type PublicRegistrationView,
  type RegistrationLink,
  type Session,
} from '@mms/shared';

/** Classes a link offers (no explicit list = every class of the session). */
export function linkClasses(link: RegistrationLink, session: Session): Class[] {
  const offered = new Set(link.classIds);
  return session.classes.filter((cls) => offered.size === 0 || offered.has(cls.id));
}

export function isWindowOpen(link: RegistrationLink, now: Date): boolean {
  const iso = now.toISOString();
  return (!link.opensAt || iso >= link.opensAt) && (!link.closesAt || iso <= link.closesAt);
}

/** Whether the link takes submissions right now (active, in window, session enrollable, under cap). */
export function acceptsSubmissions(link: RegistrationLink, session: Session, now: Date): boolean {
  return link.isActive
    && isWindowOpen(link, now)
    && SESSION_ENROLLABLE_STATES.includes(normalizeSessionStatus(session.status))
    && (link.maxSubmissions === null || link.submissionCount < link.maxSubmissions);
}

/** PII-free public view of a link; seat counts come from live section enrollment. */
export function toPublicView(link: RegistrationLink, session: Session, madrasaName: string, now: Date): PublicRegistrationView {
  return {
    slug: link.slug,
    title: link.title || session.name,
    madrasaName,
    sessionName: session.name,
    startDate: session.startDate ?? '',
    endDate: session.endDate ?? '',
    closesAt: link.closesAt,
    acceptingSubmissions: acceptsSubmissions(link, session, now),
    classes: linkClasses(link, session).map((cls) => ({
      id: cls.id,
      name: cls.name,
      gender: cls.gender ?? 'mixed',
      minAge: cls.minAge ?? 0,
      maxAge: cls.maxAge ?? 0,
      ageCalculationDate: cls.ageCalculationDate || session.startDate || '',
      seatsLeft: remainingSeats({ maxStudents: cls.maxStudents, enrolled: cls.enrolled, sections: cls.sections }),
    })),
  };
}
