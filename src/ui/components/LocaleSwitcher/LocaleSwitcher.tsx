import { Globe } from 'lucide-react';
import { LOCALE_NAMES, SUPPORTED_LOCALES, type Locale } from '@core/i18n';
import { useI18n } from '@ui/i18n/I18nProvider';

interface LocaleSwitcherProps {
  className?: string;
}

export function LocaleSwitcher({ className }: LocaleSwitcherProps) {
  const { locale, setLocale, t } = useI18n();
  return (
    <label
      className={
        'flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 ' +
        (className ?? '')
      }
      aria-label={t('nav.language')}
    >
      <Globe size={14} />
      <select
        value={locale}
        onChange={(e) => setLocale(e.target.value as Locale)}
        className="bg-transparent text-xs outline-none"
      >
        {SUPPORTED_LOCALES.map((l) => (
          <option key={l} value={l}>
            {LOCALE_NAMES[l]}
          </option>
        ))}
      </select>
    </label>
  );
}
