import { createContext, useContext } from 'react';

export interface SessionStructureLock {
  /** Parent session has started: structural edits to saved classes/sections are locked. */
  locked: boolean;
  /** Classes already persisted on the session (new classes stay fully editable). */
  savedClassIds: ReadonlySet<string>;
}

export const SessionStructureLockContext = createContext<SessionStructureLock>({ locked: false, savedClassIds: new Set() });

export function useSessionStructureLock(): SessionStructureLock {
  return useContext(SessionStructureLockContext);
}
