import { Button } from "@/components/ui/button";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { useTranslation } from "@/hooks/useTranslation";
import {
  TRANSACTION_GROUP_COLORS,
  TRANSACTION_GROUPS,
  type QuickActionType,
  type TransactionGroup,
} from "./simpleTransactionWizardTypes";
import { quickActionLabel } from "./quickActionLabels";

interface StepTypeSelectionProps {
  selected: QuickActionType | null;
  onSelect: (type: QuickActionType, advance: boolean) => void;
  /** Entry-template groups, or the built-in groups when the workspace has none. */
  groups?: readonly TransactionGroup[];
}

export function StepTypeSelection({
  selected,
  onSelect,
  groups = TRANSACTION_GROUPS,
}: StepTypeSelectionProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-5">
      {groups.map((group) => {
        const colors = TRANSACTION_GROUP_COLORS[group.color];
        const GroupIcon = group.icon;
        const translatedGroupName = t(group.groupKey);

        return (
          <article key={group.groupKey} className={`rounded-2xl border p-4 ${colors.card}`}>
            <header
              className={`flex items-center gap-2 mb-3 px-2 py-1.5 rounded-lg border w-fit ${colors.header}`}
            >
              <GroupIcon className="w-3.5 h-3.5" aria-hidden="true" />
              <SectionLabel as="h4" weight="bold" tracking="wide" tone="inherit" className="m-0">
                {translatedGroupName}
              </SectionLabel>
            </header>
            <div
              role="group"
              aria-label={translatedGroupName}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2"
            >
              {group.items.map((item) => {
                const Icon = item.icon;
                const isSelected = selected?.id === item.id;

                return (
                  <Button
                    key={item.id}
                    type="button"
                    variant="ghost"
                    aria-pressed={isSelected}
                    onClick={() =>
                      onSelect({ ...item, groupKey: group.groupKey, color: group.color }, true)
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        // Keyboard: select without advancing — user confirms via Next
                        onSelect({ ...item, groupKey: group.groupKey, color: group.color }, false);
                      }
                    }}
                    className={`h-auto min-h-11 flex flex-col items-center gap-2 p-3 rounded-xl border-2 transition-all text-center ${isSelected ? colors.selected : `border-border bg-card hover:bg-muted/50 ${colors.item}`}`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${isSelected ? colors.icon : "bg-muted text-muted-foreground"}`}
                      aria-hidden="true"
                    >
                      <Icon className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-xs font-semibold leading-tight ${isSelected ? "text-foreground" : "text-muted-foreground"}`}
                    >
                      {quickActionLabel(item, t)}
                    </span>
                  </Button>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}
