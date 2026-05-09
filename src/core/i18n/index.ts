import type { Locale, Messages } from './types';
import { en } from './locales/en';
import { zh } from './locales/zh';

export type { Locale, Messages, TranslateFn } from './types';
export { SUPPORTED_LOCALES, DEFAULT_LOCALE, LOCALE_NAMES } from './types';

const catalogs: Record<Locale, Messages> = { en, zh };

export function getMessages(locale: Locale): Messages {
  return catalogs[locale];
}

/**
 * Translate `key` for the given locale, with optional `{name}` placeholder
 * substitution. Falls back to the key itself if missing.
 */
export function translate(
  locale: Locale,
  key: string,
  params?: Record<string, string | number>,
): string {
  const fallback = catalogs.en[key];
  const raw = catalogs[locale][key] ?? fallback ?? key;
  if (!params) return raw;
  return raw.replace(/\{(\w+)\}/g, (_m, name: string) =>
    params[name] !== undefined ? String(params[name]) : `{${name}}`,
  );
}
