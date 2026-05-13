import { NavLink, useLocation } from 'react-router-dom';
import { Home, Sparkles, GraduationCap, Dumbbell, type LucideIcon } from 'lucide-react';
import { useI18n } from '@ui/i18n/I18nProvider';

interface TabSpec {
  to: string;
  matchPrefix: string;
  icon: LucideIcon;
  labelKey: string;
}

const TABS: TabSpec[] = [
  { to: '/', matchPrefix: '/', icon: Home, labelKey: 'nav.home' },
  { to: '/solve/3', matchPrefix: '/solve', icon: Sparkles, labelKey: 'nav.solve' },
  { to: '/learn/3', matchPrefix: '/learn', icon: GraduationCap, labelKey: 'nav.learn' },
  { to: '/practice/3', matchPrefix: '/practice', icon: Dumbbell, labelKey: 'nav.practice' },
];

/**
 * Native-style bottom tab bar. Always visible, sits above the AdMob banner
 * (via --ad-banner-h) and inside the system gesture inset (via --safe-bottom).
 * Active tab is matched by URL prefix so /solve/2, /solve/3, /solve/4 all
 * highlight the Solve tab.
 */
export function BottomTabBar() {
  const { t } = useI18n();
  const { pathname } = useLocation();

  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 z-30 flex items-stretch border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950"
      style={{
        bottom: 'var(--ad-banner-h)',
        height: 'calc(var(--tab-bar-h) + var(--safe-bottom))',
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      {TABS.map((tab) => {
        const isActive =
          tab.matchPrefix === '/'
            ? pathname === '/'
            : pathname === tab.matchPrefix || pathname.startsWith(tab.matchPrefix + '/');
        const Icon = tab.icon;
        return (
          <NavLink
            key={tab.matchPrefix}
            to={tab.to}
            aria-current={isActive ? 'page' : undefined}
            className={
              'flex flex-1 flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition ' +
              (isActive
                ? 'text-indigo-600 dark:text-indigo-300'
                : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100')
            }
          >
            <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
            <span>{t(tab.labelKey)}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
