import React, { useState } from "react";
import { UserCheck } from "lucide-react";
import { Modal } from "@/components/app/Modal";
import { Field } from "@/components/app/FormPrimitives";
import { FormSelect } from "@/components/app/FormSelect";
import { Textarea } from "@/components/ui/textarea";
import { DatePicker } from "@/components/app/DatePicker";
import { Switch } from "@/components/ui/switch";
import { useTranslation } from "@/hooks/useTranslation";
import { notify } from "@/lib/notify";
import type {
  FacultyLeaveDetails,
  FacultyLeaveCategory,
  FacultyMember,
  FacultyRecord,
} from "@mms/shared";
import { useFacultyContractList } from "@/tenant/features/faculty/hooks/useFacultyTsrQueries";

export interface FacultyLeaveModalProps {
  open: boolean;
  onClose: () => void;
  faculty: FacultyMember;
  onSave: (patch: Partial<FacultyMember>) => Promise<void> | void;
}

function FacultyLeaveModalContent({
  open,
  onClose,
  faculty,
  onSave,
}: FacultyLeaveModalProps): React.JSX.Element {
  const { t, dir } = useTranslation();
  const currentLeave = faculty.leaveDetails;

  const [isOnLeave, setIsOnLeave] = useState<boolean>(Boolean(currentLeave?.isOnLeave));
  const [category, setCategory] = useState<FacultyLeaveCategory | string>(
    currentLeave?.category ?? "personal",
  );
  const [startDate, setStartDate] = useState<string>(currentLeave?.startDate ?? "");
  const [endDate, setEndDate] = useState<string>(currentLeave?.endDate ?? "");
  const [substituteFacultyId, setSubstituteFacultyId] = useState<string>(
    currentLeave?.substituteFacultyId ?? "",
  );
  const [reason, setReason] = useState<string>(currentLeave?.reason ?? "");
  const [saving, setSaving] = useState(false);

  const { data: facultyResponse } = useFacultyContractList({ limit: 100 });
  const rawFacultyList: FacultyRecord[] =
    facultyResponse?.status === 200 && Array.isArray(facultyResponse.body.faculty)
      ? facultyResponse.body.faculty
      : [];
  const colleagueList: FacultyRecord[] = rawFacultyList.filter(
    (colleague: FacultyRecord) =>
      String(colleague.id) !== String(faculty.id) && !colleague.deletedAt,
  );

  const categoryOptions = [
    { value: "hajj_umrah", label: t("faculty.leave.category.hajj_umrah") },
    { value: "sickness", label: t("faculty.leave.category.sickness") },
    { value: "bereavement", label: t("faculty.leave.category.bereavement") },
    { value: "personal", label: t("faculty.leave.category.personal") },
    { value: "sabbatical", label: t("faculty.leave.category.sabbatical") },
    { value: "other", label: t("faculty.leave.category.other") },
  ];

  const substituteOptions = [
    { value: "", label: t("faculty.leave.substitutePlaceholder") },
    ...colleagueList.map((colleague: FacultyRecord) => {
      const designationSuffix = colleague.designation ? ` (${colleague.designation})` : "";
      return {
        value: String(colleague.id),
        label: `${String(colleague.name || colleague.employeeId || colleague.id)}${designationSuffix}`,
      };
    }),
  ];

  const handleSave = async () => {
    if (isOnLeave && startDate && endDate && endDate < startDate) {
      notify.error(t("faculty.leave.invalidDateRange"));
      return;
    }
    try {
      setSaving(true);
      const chosenColleague = colleagueList.find(
        (c) => String(c.id) === String(substituteFacultyId),
      );

      const nextLeaveDetails: FacultyLeaveDetails = {
        isOnLeave,
        category: isOnLeave ? category : null,
        startDate: isOnLeave && startDate ? startDate : null,
        endDate: isOnLeave && endDate ? endDate : null,
        substituteFacultyId: isOnLeave && substituteFacultyId ? substituteFacultyId : null,
        substituteFacultyName:
          isOnLeave && chosenColleague && chosenColleague.name
            ? String(chosenColleague.name)
            : null,
        reason: isOnLeave && reason ? reason.trim() : null,
      };

      await onSave({ leaveDetails: nextLeaveDetails });
      notify.success(t("faculty.leave.saved"));
      onClose();
    } catch {
      notify.error(t("faculty.toast.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t("faculty.leave.title")}
      subtitle={faculty.name || faculty.employeeId}
      icon={UserCheck}
      size="md"
      dir={dir}
      cancelLabel={t("common.cancel")}
      saveLabel={t("common.save")}
      saving={saving}
      onSave={handleSave}
    >
      <div className="space-y-4 py-2 text-start">
        <div className="flex items-center justify-between p-3.5 rounded-lg border border-border bg-muted/40">
          <div>
            <p className="font-semibold text-sm text-foreground">{t("faculty.leave.status")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isOnLeave ? t("faculty.leave.onLeave") : t("faculty.leave.active")}
            </p>
          </div>
          <Switch checked={isOnLeave} onCheckedChange={setIsOnLeave} />
        </div>

        {isOnLeave && (
          <div className="space-y-4 pt-1 animate-in fade-in duration-150">
            <Field label={t("faculty.leave.category")} id="leave-category">
              <FormSelect
                id="leave-category"
                value={category}
                onChange={(val) => setCategory(val as FacultyLeaveCategory)}
                options={categoryOptions}
              />
            </Field>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("faculty.leave.startDate")} id="leave-start-date">
                <DatePicker
                  id="leave-start-date"
                  value={startDate || undefined}
                  max={endDate || undefined}
                  onChange={(val) => setStartDate(val || "")}
                />
              </Field>

              <Field label={t("faculty.leave.endDate")} id="leave-end-date">
                <DatePicker
                  id="leave-end-date"
                  value={endDate || undefined}
                  min={startDate || undefined}
                  onChange={(val) => setEndDate(val || "")}
                />
              </Field>
            </div>

            <Field label={t("faculty.leave.substitute")} id="leave-substitute">
              <FormSelect
                id="leave-substitute"
                value={substituteFacultyId}
                onChange={setSubstituteFacultyId}
                options={substituteOptions}
              />
            </Field>

            <Field label={t("faculty.leave.reason")} id="leave-reason">
              <Textarea
                id="leave-reason"
                rows={2}
                value={reason}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReason(e.target.value)}
                placeholder="Optional leave remarks or substitute handover notes..."
              />
            </Field>
          </div>
        )}
      </div>
    </Modal>
  );
}

export function FacultyLeaveModal(props: FacultyLeaveModalProps): React.JSX.Element | null {
  if (!props.open) return null;

  return <FacultyLeaveModalContent key={props.faculty?.id ?? "leave-new"} {...props} />;
}
export default FacultyLeaveModal;
