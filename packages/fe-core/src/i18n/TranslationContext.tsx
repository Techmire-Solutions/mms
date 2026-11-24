import { createContext, useContext } from "react";
import type { AppTranslationKey, TranslationArgs } from "@mms/contracts";

export type TranslationFunction = <K extends AppTranslationKey>(
  key: K,
  ...args: TranslationArgs<K>
) => string;

export interface TranslationContextValue {
  language: string;
  t: TranslationFunction;
  isLoading: boolean;
  dir: "ltr" | "rtl";
  isRtl: boolean;
}

export const TranslationContext = createContext<TranslationContextValue | null>(null);

export function TranslationProvider({
  value,
  children,
}: {
  value: TranslationContextValue;
  children: React.ReactNode;
}): React.JSX.Element {
  return <TranslationContext.Provider value={value}>{children}</TranslationContext.Provider>;
}

export function useTranslation(): TranslationContextValue {
  const context = useContext(TranslationContext);
  if (!context) {
    return {
      language: "en",
      t: ((key: string) => key) as TranslationFunction,
      isLoading: false,
      dir: "ltr",
      isRtl: false,
    };
  }
  return context;
}
