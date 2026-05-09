export type Locale = 'en' | 'zh';

export const SUPPORTED_LOCALES: readonly Locale[] = ['en', 'zh'] as const;
export const DEFAULT_LOCALE: Locale = 'en';

export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  zh: '简体中文',
};

/**
 * Flat key-based message catalog. Nested namespaces use dot.delimited.keys.
 * Simple value substitution: `t('move.description', { face: 'top', direction: 'clockwise' })`
 * replaces `{face}` and `{direction}` in the matching string.
 */
export type Messages = Record<string, string>;

export type TranslateFn = (key: string, params?: Record<string, string | number>) => string;
