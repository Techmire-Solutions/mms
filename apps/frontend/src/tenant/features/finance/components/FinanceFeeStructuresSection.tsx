import React, { useState } from "react";
import { Layers } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SectionCard } from "@/components/ui/SectionCard";
import {
  Field,
  FormCollectionShell,
  FormListFieldCard,
  FormSelect,
} from "@/components/ui/FormPrimitives";
import { FORM_INPUT, SETUP_SECTION_CARD_CLASS } from "@/components/ui/formStyles";
import { useTranslation } from "@/hooks/useTranslation";
import { SessionClassSectionSelect, type SessionClassSectionValue } from "@/components/common/SessionClassSectionSelect";
import { useSessionsCollection } from "@/tenant/hooks/collections/sessions";
import { notify } from "@/lib/notify";
import {
  useFinanceFeeStructureMutations,
  useFinanceFeeStructures,
} from "@/tenant/features/finance/hooks/useFinanceFeeStructures";

export function FinanceFeeStructuresSection(): React.JSX.Element {
  const { t } = useTranslation();
  const { data: structures = [] } = useFinanceFeeStructures();
  const { save, remove } = useFinanceFeeStructureMutations();
  const [name, setName] = useState("");
  const sessions = useSessionsCollection();
  const [scope, setScope] = useState<SessionClassSectionValue>({ sessionId: "", classId: "", sectionId: "" });
  const [itemName, setItemName] = useState("");
  const [itemAmount, setItemAmount] = useState("");
  const [frequency, setFrequency] = useState<"monthly" | "term" | "once">("monthly");

  const handleAdd = async (): Promise<void> => {
    if (!name.trim()) return;
    try {
      await save.mutateAsync({
        name: name.trim(),
        // The server derives session/program/class names from the class id.
        sessionId: scope.sessionId || null,
        classId: scope.classId || null,
        session: sessions.find((row) => row.id === scope.sessionId)?.name ?? "",
        className: "",
        isActive: true,
        frequency,
        items: itemName.trim()
          ? [{ name: itemName.trim(), amount: Number(itemAmount || 0), sortOrder: 0 }]
          : [],
      });
      setName("");
      setScope({ sessionId: "", classId: "", sectionId: "" });
      setItemName("");
      setItemAmount("");
      setFrequency("monthly");
      notify.success(t("finance.feeStructures.saved"));
    } catch (error) {
      notify.error(t("finance.feeStructures.saveFailed"), {
        description: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return (
    <SectionCard
      title={t("finance.feeStructures.title")}
      icon={Layers}
      className={SETUP_SECTION_CARD_CLASS}
    >
      <p className="m-0 mb-3 text-xs text-muted-foreground">{t("finance.feeStructures.hint")}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <Field id="fee-struct-name" label={t("finance.feeStructures.name")}>
          <Input id="fee-struct-name" name="name" className={FORM_INPUT} value={name} onChange={(event) => setName(event.target.value)} />
        </Field>
        <SessionClassSectionSelect sessions={sessions} value={scope} onChange={setScope} idPrefix="fee-struct" />
        <Field id="fee-struct-frequency" label={t("finance.feeStructures.frequency")}>
          <FormSelect
            id="fee-struct-frequency"
            name="frequency"
            value={frequency}
            onChange={(value) => setFrequency(value as "monthly" | "term" | "once")}
            options={[
              { value: "monthly", label: t("finance.feeStructures.frequencyMonthly") },
              { value: "term", label: t("finance.feeStructures.frequencyTerm") },
              { value: "once", label: t("finance.feeStructures.frequencyOnce") },
            ]}
          />
        </Field>
        <Field id="fee-struct-item-name" label={t("finance.feeStructures.item")}>
          <div className="flex gap-2">
            <Input id="fee-struct-item-name" name="itemName" className={FORM_INPUT} value={itemName} onChange={(event) => setItemName(event.target.value)} />
            <Input
              id="fee-struct-item-amount"
              name="itemAmount"
              className={`${FORM_INPUT} w-28`}
              inputMode="decimal"
              value={itemAmount}
              onChange={(event) => setItemAmount(event.target.value)}
              aria-label={t("finance.feeStructures.amount")}
            />
          </div>
        </Field>
      </div>

      <FormCollectionShell
        className="mt-4"
        isEmpty={structures.length === 0}
        emptyMessage={t("finance.feeStructures.empty")}
        addLabel={t("finance.feeStructures.add")}
        onAdd={() => void handleAdd()}
        addDisabled={!name.trim() || save.isPending}
        listKey="fee-structures"
      >
        {structures.map((structure, index) => (
          <FormListFieldCard
            key={structure.id}
            id={structure.id}
            index={index}
            label={structure.name}
            removeLabel={`${t("common.delete")} ${structure.name}`}
            onRemove={() => void remove.mutateAsync(structure.id)}
          >
            <p className="m-0 text-xs text-muted-foreground">
              {`${[structure.className, structure.session].filter(Boolean).join(" · ") || t("finance.feeStructures.noScope")} · ${
                structure.frequency === "once"
                  ? t("finance.feeStructures.frequencyOnce")
                  : structure.frequency === "term"
                    ? t("finance.feeStructures.frequencyTerm")
                    : t("finance.feeStructures.frequencyMonthly")
              }`}
              {structure.items.length > 0 ? ` · ${structure.items.length} ${t("finance.feeStructures.items")}` : ""}
            </p>
          </FormListFieldCard>
        ))}
      </FormCollectionShell>
    </SectionCard>
  );
}
