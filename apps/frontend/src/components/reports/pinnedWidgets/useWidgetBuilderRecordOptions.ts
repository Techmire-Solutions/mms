import { useEffect } from "react";
import type { ReportCollectionsSnapshot } from "@/lib/reports/useReportCollections";
import { type Class, type Session } from "@/lib/data/sessionsData";
import type { SwitchRecordOption } from "@/components/ui/reports/pinnedWidgets/WidgetBuilderSwitchOptions";
import type { CustomWidget } from "@/lib/reports/pinnedWidgetTypes";

interface UseWidgetBuilderRecordOptionsArgs {
  collections: ReportCollectionsSnapshot;
  switchCollection: CustomWidget["collection"];
  switchRecordId: string;
  setSwitchRecordId: (switchRecordId: string) => void;
}

export function useWidgetBuilderRecordOptions({
  collections,
  switchCollection,
  switchRecordId,
  setSwitchRecordId,
}: UseWidgetBuilderRecordOptionsArgs): SwitchRecordOption[] {
  const dbRecordsList = (() => {
    if (switchCollection === "sessions") {
      const sessionRecords = (collections.sessions || []) as Session[];
      return sessionRecords.flatMap((session) =>
        (session.classes || []).map((sessionClass: Class) => ({
          id: sessionClass.id,
          label: `${session.name} - ${sessionClass.name}`,
        })),
      );
    }
    const collectionRecords = (collections[switchCollection] || []) as {
      id?: string | number;
      name?: string;
      studentName?: string;
      invoiceNo?: string;
    }[];
    return collectionRecords.map((collectionRecord) => ({
      id: String(collectionRecord.id),
      label: String(
        collectionRecord.name ||
          collectionRecord.studentName ||
          collectionRecord.invoiceNo ||
          collectionRecord.id,
      ),
    }));
  })() as SwitchRecordOption[];

  useEffect(() => {
    if (dbRecordsList.length > 0 && !switchRecordId) {
      setSwitchRecordId(dbRecordsList[0].id);
    }
  }, [dbRecordsList, switchRecordId, setSwitchRecordId]);

  return dbRecordsList;
}
