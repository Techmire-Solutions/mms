import { useState } from "react";
import { generateClientEntityId } from "@mms/shared";
import { useTranslation } from "@/hooks/useTranslation";
import type { Mujtahid, MujtahidRep, ObligationType } from "@/lib/data/obligationsData";
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

  const existingRep = reps.find((r) => r.id === initial.mujtahid_representative_id);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedMujtahidId, setSelectedMujtahidId] = useState(existingRep?.mujtahid_id || "");
  const [selectedRepId, setSelectedRepId] = useState(initial.mujtahid_representative_id || "");
  const [selectedObTypeId, setSelectedObTypeId] = useState(initial.obligation_type_id || "");

  const [initialDistributions, setInitialDistributions] = useState<InitialDistRow[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const [isAddMujtahidOpen, setIsAddMujtahidOpen] = useState(false);
  const [isAddRepOpen, setIsAddRepOpen] = useState(false);
  const [isAddObTypeOpen, setIsAddObTypeOpen] = useState(false);

  const selectedMujtahid = mujtahids.find((m) => m.id === selectedMujtahidId);
  const selectedRep = reps.find((r) => r.id === selectedRepId);
  const selectedObType = obligationTypes.find((o) => o.id === selectedObTypeId);
  const availableReps = reps.filter((r) => r.mujtahid_id === selectedMujtahidId);

  const totalPercentage = initialDistributions.reduce(
    (sum, d) => sum + (Number(d.percentage) || 0),
    0,
  );

  const validateStep1 = (): boolean => {
    const nextErrors: Record<string, string> = {};
    if (!selectedMujtahidId) nextErrors.mujtahid = "Please select or create a Mujtahid";
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
    if (totalPercentage > 100) {
      setErrors({ dist: t("obligations.wakala.pctExceed", { pct: totalPercentage }) });
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
        initialDistributions.length > 0 ? initialDistributions : undefined,
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
    setInitialDistributions((prev) => [
      ...prev,
      { id: generateClientEntityId("dist"), name: "", percentage: 0, type: "Income" },
    ]);
  };

  const removeDistributionRow = (id: string) => {
    setInitialDistributions((prev) => prev.filter((d) => d.id !== id));
  };

  const updateDistributionRow = (id: string, updates: Partial<InitialDistRow>) => {
    setInitialDistributions((prev) => prev.map((d) => (d.id === id ? { ...d, ...updates } : d)));
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
