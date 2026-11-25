import { brandingTokenToCss, brandingTokenToHex } from "@mms/contracts";

import { useTranslation } from "@mms/fe-core/i18n";

import { DERIVED_SWATCHES, type BrandingTokens } from "./brandColorPanelShared";

interface BrandDerivedTokensProps {
  tokens: BrandingTokens;
}

export function BrandDerivedTokens({ tokens }: BrandDerivedTokensProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground">{t("theme.derivedTokensTitle")}</h3>
      <p className="text-xs text-muted-foreground">{t("theme.derivedTokensDesc")}</p>
      <div className="flex flex-wrap gap-2">
        {DERIVED_SWATCHES.map((swatch) => {
          const rawVal = tokens[swatch.token];
          const hex = rawVal ? brandingTokenToHex(rawVal) : "";
          return (
            <div
              key={swatch.labelKey}
              title={`${t(swatch.labelKey)}: ${hex || rawVal}`}
              className="flex items-center gap-2 rounded-lg border border-border/80 bg-card/60 px-2.5 py-1.5 shadow-2xs transition-all hover:border-primary/40 hover:bg-card"
            >
              <span
                className="h-5 w-5 shrink-0 rounded-md border border-white/20 shadow-2xs"
                style={{ backgroundColor: rawVal ? brandingTokenToCss(rawVal) : undefined }}
                aria-hidden
              />
              <span className="text-xs font-medium text-foreground">{t(swatch.labelKey)}</span>
              {hex && (
                <span className="font-mono text-3xs text-muted-foreground font-semibold ps-0.5">
                  {hex}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
