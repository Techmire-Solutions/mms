import { useSyncExternalStore } from 'react';
import type { SessionEditViolation } from '@mms/shared';
import { isApiError } from '@/lib/apiError';

interface PromptState {
  violations: SessionEditViolation[];
  resolve: (reason: string | null) => void;
}

let current: PromptState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

/** Violation codes from a `409 session_locked` response ("…: startDate, category"). */
export function sessionLockViolations(error: unknown): SessionEditViolation[] | null {
  if (!isApiError(error) || error.status !== 409 || error.type !== 'session_locked') return null;
  const list = error.message.split(':').pop() ?? '';
  return list.split(',').map((code) => code.trim()).filter(Boolean) as SessionEditViolation[];
}

/** Opens the override dialog; resolves with the reason, or null when cancelled. */
export function requestSessionLockOverride(violations: SessionEditViolation[]): Promise<string | null> {
  current?.resolve(null);
  return new Promise((resolve) => {
    current = { violations, resolve };
    emit();
  });
}

export function respondSessionLockOverride(reason: string | null): void {
  const pending = current;
  current = null;
  emit();
  pending?.resolve(reason);
}

export function useSessionLockOverridePrompt(): PromptState | null {
  return useSyncExternalStore(
    (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    () => current,
    () => null,
  );
}

/**
 * Runs a session save; on `session_locked` lets authorized users confirm with a reason and retries
 * with `lockOverrideReason` (audited server-side). Others get the original error.
 */
export async function withSessionLockOverride<T>(
  canOverride: boolean,
  save: (lockOverrideReason?: string) => Promise<T>,
): Promise<T> {
  try {
    return await save();
  } catch (error) {
    const violations = sessionLockViolations(error);
    if (!violations || !canOverride) throw error;
    const reason = await requestSessionLockOverride(violations);
    if (!reason) throw error;
    return save(reason);
  }
}
