import React, { createContext, useContext, useEffect } from 'react';
import { useTranslation } from '@/hooks/useTranslation';
import {
  getLanguageDirection,
  isRtlLanguage,
  type AppLanguageCode,
} from '@mms/shared';
import { applyDocumentLanguage } from '@/lib/documentLanguage';
import { ensureLocaleFontsLoaded } from '@/lib/localeFonts';

export interface DirectionContextValue {
  dir: 'ltr' | 'rtl';
  isRtl: boolean;
  language: string;
}

const DirectionContext = createContext<DirectionContextValue>({
  dir: 'ltr',
  isRtl: false,
  language: 'en',
});

export interface DirectionProviderProps {
  children: React.ReactNode;
}

/**
 * BiDi Direction Provider
 * Synchronizes HTML document `dir`, `lang`, and multi-script font classes
 * based on the active language from TranslationContext.
 */
export function DirectionProvider({ children }: DirectionProviderProps): React.JSX.Element {
  const { language } = useTranslation();
  const dir = getLanguageDirection(language);
  const isRtl = isRtlLanguage(language);

  useEffect(() => {
    applyDocumentLanguage(language);
    ensureLocaleFontsLoaded(language as AppLanguageCode);

    if (typeof document !== 'undefined') {
      const root = document.documentElement;
      root.setAttribute('dir', dir);
      root.setAttribute('lang', language);

      // Manage typography script classes on the document element
      root.classList.remove('font-arabic', 'font-urdu', 'font-persian');
      if (language === 'ar') {
        root.classList.add('font-arabic');
      } else if (language === 'ur') {
        root.classList.add('font-urdu');
      } else if (language === 'fa') {
        root.classList.add('font-persian');
      }
    }
  }, [language, dir]);

  const value = (() => ({
      dir,
      isRtl,
      language,
    }))() as DirectionContextValue;

  return <DirectionContext.Provider value={value}>{children}</DirectionContext.Provider>;
}

export function useDirection(): DirectionContextValue {
  return useContext(DirectionContext);
}
