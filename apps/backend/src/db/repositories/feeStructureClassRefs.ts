import type { FeeStructure } from '@mms/shared';
import type { TenantTransaction } from '../tenant-context.js';
import { loadSessionClassRefTx } from './sessionClassRefs.js';

/**
 * When a fee structure targets a class, the class id is authoritative: session, program and the
 * text snapshots are derived from it server-side. Without a class the free-text scope is kept.
 */
export async function resolveFeeStructureClassRefsTx(tx: TenantTransaction, subdomain: string, record: FeeStructure): Promise<FeeStructure> {
  const ref = await loadSessionClassRefTx(tx, subdomain, record.classId);
  if (!ref) return { ...record, classId: null };
  return {
    ...record,
    classId: ref.classId,
    className: ref.className,
    sessionId: ref.sessionId,
    session: ref.sessionName,
    programId: ref.programId,
  };
}
