import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Locale, TranslateFn } from '@core/i18n';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES, translate } from '@core/i18n';

interface I18nContextValue {
  locale: Locale;
  t: TranslateFn;
  setLocale: (l: Locale) => void;
}

const I18nContext = createContext<I18nContextValue | null>(null);

const STORAGE_KEY = 'cubist.locale';

function detectInitialLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE;
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY) as Locale | null;
    if (saved && (SUPPORTED_LOCALES as readonly string[]).includes(saved)) return saved;
  } catch {
    // ignore — private mode etc.
  }
  // Heuristic from browser language: prefer zh if the navigator is Chinese.
  const nav = window.navigator?.language?.toLowerCase() ?? '';
  if (nav.startsWith('zh')) return 'zh';
  return DEFAULT_LOCALE;
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(detectInitialLocale);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // ignore
    }
    document.documentElement.lang = locale === 'zh' ? 'zh-CN' : 'en';
  }, [locale]);

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (l) => setLocaleState(l),
      t: (key, params) => translate(locale, key, params),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
