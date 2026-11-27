import React from "react";
import { Field } from "@mms/ui/app/FormField";
import { FORM_INPUT_BUILDER } from "@mms/ui";
import { FormSelect } from "@mms/fe-core/components/FormSelect";
import { Input } from "@mms/ui";
import { useTranslation } from "@mms/fe-core/i18n";
import { COLLECTION_OPTIONS, getCollectionLabel } from "../../lib/reportMetadata";
import type { CustomWidget } from "../../lib/pinnedWidgetTypes";

export interface SwitchRecordOption {
  id: string;
  label: string;
}

interface WidgetBuilderSwitchOptionsProps {
  switchActionType: "app_setting" | "db_record";
  setSwitchActionType: (switchActionType: "app_setting" | "db_record") => void;
  switchStateKey: string;
  setSwitchStateKey: (switchStateKey: string) => void;
  switchCollection: CustomWidget["collection"];
  setSwitchCollection: (switchCollection: CustomWidget["collection"]) => void;
  switchRecordId: string;
  setSwitchRecordId: (switchRecordId: string) => void;
  switchLabelOn: string;
  setSwitchLabelOn: (switchLabelOn: string) => void;
  switchLabelOff: string;
  setSwitchLabelOff: (switchLabelOff: string) => void;
  dbRecordsList: SwitchRecordOption[];
}

export function WidgetBuilderSwitchOptions({
  switchActionType,
  setSwitchActionType,
  switchStateKey,
  setSwitchStateKey,
  switchCollection,
  setSwitchCollection,
  switchRecordId,
  setSwitchRecordId,
  switchLabelOn,
  setSwitchLabelOn,
  switchLabelOff,
  setSwitchLabelOff,
  dbRecordsList,
}: WidgetBuilderSwitchOptionsProps): React.JSX.Element {
  const { t } = useTranslation();

  return (
    <>
      <Field label={t("reports.widgets.builder.switchTarget")} id="wbs-target">
        <FormSelect
          id="wbs-target"
          value={switchActionType}
          onChange={(val: any) => setSwitchActionType(val as "app_setting" | "db_record")}
          options={[
            { value: "app_setting", label: t("reports.widgets.builder.switchTargetApp") },
            { value: "db_record", label: t("reports.widgets.builder.switchTargetDb") },
          ]}
        />
      </Field>

      {switchActionType === "app_setting" ? (
        <Field label={t("reports.widgets.builder.selectParameter")} id="wbs-param">
          <FormSelect
            id="wbs-param"
            value={switchStateKey}
            onChange={setSwitchStateKey}
            options={[
              {
                value: "section_enrollmentChart",
                label: t("reports.widgets.builder.paramEnrollmentChart"),
              },
              {
                value: "section_revenueChart",
                label: t("reports.widgets.builder.paramRevenueChart"),
              },
              {
                value: "section_attendanceChart",
                label: t("reports.widgets.builder.paramAttendanceChart"),
              },
              {
                value: "section_hasanatChart",
                label: t("reports.widgets.builder.paramHasanatChart"),
              },
              {
                value: "section_sessionsTable",
                label: t("reports.widgets.builder.paramSessionsTable"),
              },
              {
                value: "app_setting_attendance_lock",
                label: t("reports.widgets.builder.paramAttendanceLock"),
              },
              {
                value: "app_setting_mute_notifications",
                label: t("reports.widgets.builder.paramMuteNotifications"),
              },
            ]}
          />
        </Field>
      ) : (
        <>
          <Field label={t("reports.widgets.builder.recordCollection")} id="wbs-collection">
            <FormSelect
              id="wbs-collection"
              value={switchCollection}
              onChange={(val: any) => {
                setSwitchCollection(val as CustomWidget["collection"]);
                setSwitchRecordId("");
              }}
              options={COLLECTION_OPTIONS.map((collectionOption: any) => ({
                value: collectionOption.value,
                label: getCollectionLabel(collectionOption.value, collectionOption.label, t),
              }))}
            />
          </Field>

          <Field label={t("reports.widgets.builder.selectRecord")} id="wbs-record">
            <FormSelect
              id="wbs-record"
              value={switchRecordId}
              onChange={setSwitchRecordId}
              options={
                dbRecordsList.length === 0
                  ? [{ value: "", label: t("reports.widgets.builder.noRecordsLoaded") }]
                  : dbRecordsList.map((rec: any) => ({ value: rec.id, label: rec.label }))
              }
            />
          </Field>
        </>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <Field label={t("reports.widgets.builder.labelOn")} id="wbs-label-on">
          <Input
            id="wbs-label-on"
            type="text"
            value={switchLabelOn}
            onChange={(event: any) => setSwitchLabelOn(event.target.value)}
            placeholder={t("reports.widgets.builder.placeholderActive")}
            className={FORM_INPUT_BUILDER}
          />
        </Field>
        <Field label={t("reports.widgets.builder.labelOff")} id="wbs-label-off">
          <Input
            id="wbs-label-off"
            type="text"
            value={switchLabelOff}
            onChange={(event: any) => setSwitchLabelOff(event.target.value)}
            placeholder={t("reports.widgets.builder.placeholderInactive")}
            className={FORM_INPUT_BUILDER}
          />
        </Field>
      </div>
    </>
  );
}
