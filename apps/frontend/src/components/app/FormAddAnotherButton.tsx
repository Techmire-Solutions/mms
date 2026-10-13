import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface FormAddAnotherButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

/**
 * SSOT control for appending another row to a form collection list
 * (contacts phones/emails, faculty designations, etc.).
 */
export function FormAddAnotherButton({
  label,
  onClick,
  disabled = false,
  className,
}: FormAddAnotherButtonProps): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="outline"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "w-full flex items-center justify-center gap-2 border-dashed border-border/80 hover:border-primary/50 hover:bg-primary/5 font-semibold text-xs py-2.5 rounded-xl transition-all min-h-11 text-primary cursor-pointer",
        className,
      )}
    >
      <Plus className="w-3.5 h-3.5" aria-hidden />
      <span>{label}</span>
    </Button>
  );
}
