import type React from "react";
import type { ErdRelationship } from "@mms/shared";
import { ArrowRight } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { WORK_SURFACE } from "@/components/ui/formStyles";

interface ErdRelationshipListProps {
  relationships: readonly ErdRelationship[];
}

export function ErdRelationshipList({
  relationships,
}: ErdRelationshipListProps): React.JSX.Element {
  const { t } = useTranslation();

  if (relationships.length === 0) {
    return <></>;
  }

  return (
    <section className={cnSurface()} aria-labelledby="erd-relationships-heading">
      <h3
        id="erd-relationships-heading"
        className="text-sm font-semibold text-foreground text-balance"
      >
        {t("platform.erdRelationships")}
      </h3>
      <ul className="mt-3 space-y-2">
        {relationships.map((rel) => (
          <li
            key={`${rel.fromTable}.${rel.fromColumn}->${rel.toTable}.${rel.toColumn}`}
            className="flex flex-wrap items-center gap-2 rounded-xl border border-border/60 bg-background/60 px-3 py-2 text-xs"
          >
            <span className="font-mono text-foreground">
              {rel.fromTable}.{rel.fromColumn}
            </span>
            <ArrowRight
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground rtl:rotate-180"
              aria-hidden
            />
            <span className="font-mono text-foreground">
              {rel.toTable}.{rel.toColumn}
            </span>
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">
              {rel.cardinality}
            </span>
            {rel.onDelete ? (
              <span className="text-2xs text-muted-foreground">
                {t("platform.erdOnDelete", { action: rel.onDelete })}
              </span>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function cnSurface(): string {
  return `${WORK_SURFACE} p-4`;
}
