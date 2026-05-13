import { NavLink } from 'react-router-dom';
import type { CubeSize } from '@core/cube/ICube';
import { useI18n } from '@ui/i18n/I18nProvider';

export interface SizeSelectorProps {
  section: 'solve' | 'learn' | 'practice';
  /** Sizes to expose for this section. */
  sizes: readonly CubeSize[];
}

/**
 * Segmented control that switches the in-section cube size. The bottom tab
 * bar handles cross-section navigation; this handles size-within-section.
 * Stays inside the page header so users see what they're toggling.
 */
export function SizeSelector({ section, sizes }: SizeSelectorProps) {
  const { t } = useI18n();
  return (
    <div
      className="inline-flex rounded-md border border-slate-200 bg-slate-100 p-0.5 text-xs dark:border-slate-700 dark:bg-slate-900"
      role="tablist"
      aria-label={t('nav.size.aria')}
    >
      {sizes.map((s) => (
        <NavLink
          key={s}
          to={`/${section}/${s}`}
          end
          className={({ isActive }) =>
            'rounded px-3 py-1 font-medium transition ' +
            (isActive
              ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-50'
              : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100')
          }
          role="tab"
        >
          {t(`nav.cube${s}`)}
        </NavLink>
      ))}
    </div>
  );
}
