import { useState } from "react";
import { generateClientEntityId, obligationDistributionInsertSchema } from "@mms/contracts";
import { useTranslation } from "@mms/fe-core/i18n";
import { useIdentityReset } from "@mms/fe-core/forms/useIdentityReset";
import type { Mujtahid, MujtahidRep, ObligationType } from "../../lib/obligationsData";
import type { InitialDistRow, WakalaFormModalProps } from "./wakalaFormModalTypes";

export function useWakalaFormModalState(props: WakalaFormModalProps) {
  const {
    initial,
    reps,
    mujtahids,
    obligationTypes,
    onSave,
    onChangeMujtahids,
    onChangeReps,
    onChangeTypes,
  } = props;
  const { t } = useTranslation();

  const existingRep = reps.find((r: any) => r.id === initial.mujtahid_representative_id);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedMujtahidId, setSelectedMujtahidId] = useState(existingRep?.mujtahid_id || "");
  const [selectedRepId, setSelectedRepId] = useState(initial.mujtahid_representative_id || "");
  const [selectedObTypeId, setSelectedObTypeId] = useState(initial.obligation_type_id || "");

  const [initialDistributions, setInitialDistributions] = useState<InitialDistRow[]>(
    () => props.initialDistributions ?? [],
  );
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  // Editing wakala A then wakala B (or add → edit) must not keep A's selections/splits.
  useIdentityReset(String(initial.id ?? "new"), () => {
    setStep(1);
    setSelectedMujtahidId(existingRep?.mujtahid_id || "");
    setSelectedRepId(initial.mujtahid_representative_id || "");
    setSelectedObTypeId(initial.obligation_type_id || "");
    setInitialDistributions(props.initialDistributions ?? []);
    setErrors({});
    setSubmitError("");
  });

  const [isAddMujtahidOpen, setIsAddMujtahidOpen] = useState(false);
  const [isAddRepOpen, setIsAddRepOpen] = useState(false);
  const [isAddObTypeOpen, setIsAddObTypeOpen] = useState(false);

  const selectedMujtahid = mujtahids.find((m: any) => m.id === selectedMujtahidId);
  const selectedRep = reps.find((r: any) => r.id === selectedRepId);
  const selectedObType = obligationTypes.find((o: any) => o.id === selectedObTypeId);
  const availableReps = reps.filter((r: any) => r.mujtahid_id === selectedMujtahidId);

  const totalPercentage = initialDistributions.reduce(
    (sum: any, d: any) => sum + (Number(d.percentage) || 0),
    0,
  );

  const validateStep1 = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!selectedMujtahidId) nextErrors.mujtahid = t("obligations.wakala.mujtahidRequired");
    if (!selectedObTypeId) nextErrors.obType = t("obligations.wakala.typeRequired");
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!selectedRepId) nextErrors.rep = t("obligations.wakala.repRequired");
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const validateStep3 = (): boolean => {
    if (
      initialDistributions.some(
        (row: any) => row.percentage === null || row.percentage === undefined,
      )
    ) {
      setErrors({ dist: t("obligations.wakala.pctInvalid") });
      return false;
    }
    if (totalPercentage > 100) {
      setErrors({ dist: t("obligations.wakala.pctExceed", { pct: totalPercentage }) });
      return false;
    }
    // Same row contract the aggregate endpoint validates; the parent supplies the
    // real wakala id, so a stable placeholder is enough for the shape check.
    const invalidRow = initialDistributions.some(
      (row: any) =>
        !obligationDistributionInsertSchema.safeParse({
          name: row.name,
          percentage: Number(row.percentage ?? 0),
          wakala_type_id: String(initial.id ?? "pending-wakala"),
          type: row.type,
          account_id: row.account_id ?? null,
        }).success,
    );
    if (invalidRow) {
      setErrors({ dist: t("common.formPleaseFixErrors") });
      return false;
    }
    return true;
  };

  const handleSave = async (): Promise<void> => {
    if (!validateStep3()) return;
    setSubmitError("");
    setSaving(true);
    try {
      await onSave(
        {
          ...initial,
          mujtahid_representative_id: selectedRepId,
          obligation_type_id: selectedObTypeId,
        },
        initialDistributions.length > 0
          ? initialDistributions.map((row: any) => ({
              ...row,
              percentage: Number(row.percentage ?? 0),
            }))
          : undefined,
      );
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : t("obligations.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const handleNextOrSave = async (): Promise<void> => {
    if (step === 1 && validateStep1()) setStep(2);
    else if (step === 2 && validateStep2()) setStep(3);
    else if (step === 3) await handleSave();
  };

  const handleSaveMujtahid = async (newMujtahid: Partial<Mujtahid>) => {
    if (onChangeMujtahids) {
      const id = generateClientEntityId("m");
      await onChangeMujtahids([...mujtahids, { ...newMujtahid, id } as Mujtahid]);
      setSelectedMujtahidId(id);
      setSelectedRepId("");
    }
    setIsAddMujtahidOpen(false);
  };

  const handleSaveRep = async (newRep: Partial<MujtahidRep>) => {
    if (onChangeReps && selectedMujtahidId) {
      const id = generateClientEntityId("mr");
      await onChangeReps([
        ...reps,
        { ...newRep, id, mujtahid_id: selectedMujtahidId } as MujtahidRep,
      ]);
      setSelectedRepId(id);
    }
    setIsAddRepOpen(false);
  };

  const handleSaveObType = async (newType: Partial<ObligationType>) => {
    if (onChangeTypes) {
      const id = generateClientEntityId("ot");
      const created: ObligationType = {
        ...newType,
        id,
        name: newType.name || "",
        designated_for: newType.designated_for || "Both",
        quantity_based: !!newType.quantity_based,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as ObligationType;
      await onChangeTypes([...obligationTypes, created]);
      setSelectedObTypeId(id);
    }
    setIsAddObTypeOpen(false);
  };

  const addDistributionRow = () => {
    setInitialDistributions((prev: any) => [
      ...prev,
      { id: generateClientEntityId("dist"), name: "", percentage: null, type: "Income" },
    ]);
  };

  const removeDistributionRow = (id: string) => {
    setInitialDistributions((prev: any) => prev.filter((d: any) => d.id !== id));
  };

  const updateDistributionRow = (id: string, updates: Partial<InitialDistRow>) => {
    setInitialDistributions((prev: any) =>
      prev.map((d: any) => (d.id === id ? { ...d, ...updates } : d)),
    );
  };

  const isChildModalOpen = isAddMujtahidOpen || isAddRepOpen || isAddObTypeOpen;

  return {
    step,
    setStep,
    selectedMujtahidId,
    setSelectedMujtahidId,
    selectedRepId,
    setSelectedRepId,
    selectedObTypeId,
    setSelectedObTypeId,
    selectedMujtahid,
    selectedRep,
    selectedObType,
    availableReps,
    initialDistributions,
    totalPercentage,
    errors,
    setErrors,
    saving,
    submitError,
    validateStep1,
    validateStep2,
    validateStep3,
    handleSave,
    handleNextOrSave,
    addDistributionRow,
    removeDistributionRow,
    updateDistributionRow,
    isChildModalOpen,
    isAddMujtahidOpen,
    setIsAddMujtahidOpen,
    isAddRepOpen,
    setIsAddRepOpen,
    isAddObTypeOpen,
    setIsAddObTypeOpen,
    handleSaveMujtahid,
    handleSaveRep,
    handleSaveObType,
  };
}
