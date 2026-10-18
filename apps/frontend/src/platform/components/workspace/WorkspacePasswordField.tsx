import { useId } from "react";
import { RefreshCw } from "lucide-react";
import { Button, Field, Input } from "@shared/ui";
import { useTranslation } from "@/hooks/useTranslation";
import { generateTemporaryPassword } from "@/lib/generateTemporaryPassword";

export function WorkspacePasswordField({
  label,
  placeholder,
  value,
  onChange,
  pending,
  error,
}: {
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  pending: boolean;
  error?: string;
}): React.JSX.Element {
  const id = useId();
  const { t } = useTranslation();
  return (
    <Field id={id} label={label} error={error}>
      <div className="flex flex-wrap items-center gap-2">
        <Input
          id={id}
          name="newAdminPassword"
          type="text"
          autoComplete="new-password"
          placeholder={placeholder}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="font-mono text-sm h-11 flex-1 min-w-0"
          disabled={pending}
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          icon={RefreshCw}
          onClick={() => onChange(generateTemporaryPassword())}
          disabled={pending}
          className="shrink-0 cursor-pointer font-semibold"
          title={t("platform.autoGenerateTitle")}
          aria-label={t("platform.autoGenerateTitle")}
        >
          {t("platform.autoGenerateBtn")}
        </Button>
      </div>
    </Field>
  );
}
