import type React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SectionLabel } from "@/components/ui/SectionLabel";
import { Slider } from "@/components/ui/slider";
import type { TranslationFunction } from "@/lib/contexts/TranslationContext";

interface LlmConfigModalHyperparametersProps {
  formTemperature: number;
  setFormTemperature: (value: number) => void;
  formMaxTokens: number;
  setFormMaxTokens: (value: number) => void;
  formTopP: number;
  setFormTopP: (value: number) => void;
  t: TranslationFunction;
}

export function LlmConfigModalHyperparameters({
  formTemperature,
  setFormTemperature,
  formMaxTokens,
  setFormMaxTokens,
  formTopP,
  setFormTopP,
  t,
}: LlmConfigModalHyperparametersProps): React.JSX.Element {
  return (
    <div className="space-y-4 border-t border-border pt-4">
      <SectionLabel as="h5" weight="semibold" tracking="wider">
        {t("settings.llmModalHyperparameters")}
      </SectionLabel>
      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold">
            <Label htmlFor="temperature">{t("settings.llmModalTemperature")}</Label>
            <span className="font-mono text-xs text-muted-foreground/80">
              {formTemperature.toFixed(1)}
            </span>
          </div>
          <Slider
            id="temperature"
            name="temperature"
            min={0.0}
            max={2.0}
            step={0.1}
            value={[formTemperature]}
            onValueChange={(val) => setFormTemperature(val[0] ?? 0.7)}
          />
          <p className="text-xs text-muted-foreground">{t("settings.llmModalTemperatureDesc")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="maxTokens" className="text-xs font-semibold">
              {t("settings.llmModalMaxTokens")}
            </Label>
            <Input
              id="maxTokens"
              name="maxTokens"
              type="text"
              inputMode="numeric"
              min={1}
              max={16384}
              value={formMaxTokens}
              onChange={(event) => setFormMaxTokens(parseInt(event.target.value, 10) || 2048)}
            />
            <p className="text-xs text-muted-foreground">{t("settings.llmModalMaxTokensDesc")}</p>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold">
              <Label htmlFor="topP">{t("settings.llmModalTopP")}</Label>
              <span className="font-mono text-xs text-muted-foreground/80">
                {formTopP.toFixed(2)}
              </span>
            </div>
            <Slider
              id="topP"
              name="topP"
              min={0.0}
              max={1.0}
              step={0.05}
              value={[formTopP]}
              onValueChange={(val) => setFormTopP(val[0] ?? 1.0)}
            />
            <p className="text-xs text-muted-foreground">{t("settings.llmModalTopPDesc")}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
