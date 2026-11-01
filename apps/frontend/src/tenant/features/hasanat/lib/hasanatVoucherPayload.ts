/**
 * @file hasanatVoucherPayload.ts
 * @description Maps a hasanat distribution into the flat voucher payload the hasanat
 * template binds to.
 */

import type { Denomination, Distribution } from "@/lib/data/hasanatData";
import type { HasanatPayload } from "./hasanatTemplateData";

export interface BuildHasanatVoucherPayloadOptions {
  distribution: Distribution;
  /** Denomination of the issued batch; when absent the quantity is shown as points. */
  denomination?: Denomination | null;
  institution: string;
}

export function buildHasanatVoucherPayload({
  distribution,
  denomination = null,
  institution,
}: BuildHasanatVoucherPayloadOptions): HasanatPayload {
  const pointsPerUnit = denomination?.points ?? 1;
  const totalPoints = pointsPerUnit * distribution.quantity;

  return {
    institution,
    receiptNo: distribution.id,
    // A distribution has no donor field; leave it blank rather than inventing one.
    donorName: "",
    recipientName: distribution.recipientName,
    denomination: distribution.denominationName,
    totalPoints: `${totalPoints} Hasanat`,
    issueDate: distribution.issuedDate,
    // Vouchers issued by this module do not expire.
    expiryDate: "",
    purpose: distribution.reason,
    issuedBy: distribution.issuedBy ?? "",
  };
}
