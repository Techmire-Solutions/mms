import { describe, expect, it } from 'vitest';
import { SessionSchema, type Session } from '@mms/shared';
import { assertSessionEditable, SessionLockedError } from '../sessions/use-cases/sessionLockGuard.js';

function session(status: string, overrides: Partial<Session> = {}): Session {
  return SessionSchema.parse({
    id: 'ses-1', name: 'Hifz 2026', startDate: '2026-01-01', status,
    classes: [{ id: 'cls-1', name: 'Darja 1', gender: 'male', minAge: 6, maxAge: 12, enrolled: 4 }],
    ...overrides,
  });
}

describe('assertSessionEditable', () => {
  it('given an in-progress session, should throw session_locked when the start date changes without override', () => {
    // Arrange
    const before = session('in_progress');

    // Act
    const act = () => assertSessionEditable(before, { ...before, startDate: '2026-02-01' }, { canOverrideLock: false });

    // Assert
    expect(act).toThrow(SessionLockedError);
    expect(act).toThrow(expect.objectContaining({ statusCode: 409, type: 'session_locked' }));
  });

  it('given an authorized override with a reason, should return the overridden violations', () => {
    // Arrange
    const before = session('in_progress');

    // Act
    const overridden = assertSessionEditable(before, { ...before, startDate: '2026-02-01', classes: [] }, {
      canOverrideLock: true, lockOverrideReason: 'Ramadan postponement',
    });

    // Assert
    expect([...overridden].sort()).toEqual(['classRemoved', 'startDate']);
  });

  it('given an override permission without a reason, should still block', () => {
    // Arrange
    const before = session('in_progress');

    // Act
    const act = () => assertSessionEditable(before, { ...before, startDate: '2026-02-01' }, { canOverrideLock: true, lockOverrideReason: '  ' });

    // Assert
    expect(act).toThrow(SessionLockedError);
  });

  it('given a disallowed status transition, should throw a 400 validation error', () => {
    // Arrange
    const before = session('completed');

    // Act
    const act = () => assertSessionEditable(before, { ...before, status: 'in_progress' }, { canOverrideLock: true, lockOverrideReason: 'reopen' });

    // Assert
    expect(act).toThrow(expect.objectContaining({ statusCode: 400 }));
  });

  it('given an open session, should allow structural edits', () => {
    // Arrange
    const before = session('open');

    // Act
    const overridden = assertSessionEditable(before, { ...before, startDate: '2026-03-01', classes: [] }, { canOverrideLock: false });

    // Assert
    expect(overridden).toEqual([]);
  });
});
