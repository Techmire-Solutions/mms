/**
 * Shared Hasanat enums — the single literal source for every typed set.
 *
 * Card statuses live with the lifecycle rules (`HASANAT_CARD_STATUSES` in `hasanatCardRules`), since
 * that state machine is their owner. The sets below are referenced by the Zod contracts; the
 * database check constraints carry the same literals, and a persistence test asserts they match.
 */

/** Who a card is issued to. */
export const HASANAT_RECIPIENT_TYPES = ["student", "faculty"] as const;
export type HasanatRecipientType = (typeof HASANAT_RECIPIENT_TYPES)[number];

/**
 * Append-only ledger row kind: `redeem` burns a card's value, `reversal` compensates one redemption.
 * There is no `credit` row — the immutable card itself is the credit record.
 */
export const HASANAT_LEDGER_KINDS = ["redeem", "reversal"] as const;
export type HasanatLedgerKind = (typeof HASANAT_LEDGER_KINDS)[number];

/** Tier evidence kind: ladder tiers and badges share the award table. */
export const HASANAT_AWARD_KINDS = ["tier", "badge"] as const;
export type HasanatAwardKind = (typeof HASANAT_AWARD_KINDS)[number];
