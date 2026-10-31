import type { WorkDirectoryViewMode } from "@/hooks/useWorkDirectoryViewMode";
import type { StatusBadgeConfigItem } from "@/components/app/StatusBadge";
import type {
  Mujtahid,
  MujtahidRep,
  ObligationCollection,
  ObligationType,
} from "@/lib/data/obligationsData";
import { DEFAULT_CURRENCIES, formatMoney } from "@mms/shared";

export interface ObligationContact {
  name?: string;
}

export interface ObligationCollectionListContentProps {
  viewMode: WorkDirectoryViewMode;
  collections: ObligationCollection[];
  search: string;
  typeFilter: string;
  selectedIds: string[];
  isColumnVisible: (key: string) => boolean;
  allVisibleSelected: boolean;
  someVisibleSelected: boolean;
  canWrite: boolean;
  canDelete: boolean;
  showDeleted: boolean;
  paymentModeConfig: Record<string, StatusBadgeConfigItem>;
  getContact: (contactId?: string | number | null) => ObligationContact | undefined;
  getRep: (repId: string) => MujtahidRep | undefined;
  getMujtahid: (repId: string) => Mujtahid | null | undefined;
  getObligationType: (obligationTypeId: string) => ObligationType | undefined;
  getColumnWidth?: (key: string) => number | undefined;
  onColumnResize?: (key: string, width: number) => void;
  onAddNew: () => void;
  onView: (collection: ObligationCollection) => void;
  onPrint: (collection: ObligationCollection) => void;
  onToggleSelectAll: (checked: boolean) => void;
  onToggleSelectedCollection: (id: string, checked: boolean) => void;
  onTrashAction: (id: string) => void;
  onMessage?: (channel: "sms" | "whatsapp" | "email", collections: ObligationCollection[]) => void;
  onViewVoucher?: (collection: ObligationCollection) => void;
}

export const OBLIGATION_COLLECTION_CURRENCIES = DEFAULT_CURRENCIES;

export function getObligationCollectionResolvedFields(
  collection: ObligationCollection,
  helpers: Pick<
    ObligationCollectionListContentProps,
    "getContact" | "getRep" | "getMujtahid" | "getObligationType"
  >,
): {
  sender: ObligationContact | undefined;
  obligationType: ObligationType | undefined;
  rep: MujtahidRep | undefined;
  mujtahid: Mujtahid | null | undefined;
} {
  return {
    sender: helpers.getContact(collection.sender_id),
    obligationType: helpers.getObligationType(collection.obligation_type_id),
    rep: helpers.getRep(collection.mujtahid_representative_id),
    mujtahid: helpers.getMujtahid(collection.mujtahid_representative_id),
  };
}

export function formatObligationCollectionAmount(collection: ObligationCollection): string {
  return formatMoney(
    collection.amount,
    OBLIGATION_COLLECTION_CURRENCIES.find((currency) => currency.id === collection.currency_id)
      ?.code,
  );
}
