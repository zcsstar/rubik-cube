import { Routes, Route, Link, NavLink } from 'react-router-dom';
import { HomePage } from '@ui/pages/HomePage';
import { SolvePage } from '@ui/pages/SolvePage';
import { TutorialPage } from '@ui/pages/TutorialPage';
import { NotFoundPage } from '@ui/pages/NotFoundPage';
import { Logo } from '@ui/components/Logo';
import { LocaleSwitcher } from '@ui/components/LocaleSwitcher/LocaleSwitcher';
import { useI18n } from '@ui/i18n/I18nProvider';

function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  const navLink = ({ isActive }: { isActive: boolean }) =>
    'rounded-md px-2.5 py-1 text-sm font-medium transition ' +
    (isActive
      ? 'text-slate-900 dark:text-slate-50'
      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100');
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
            <Logo size={26} />
            <span className="text-base font-semibold tracking-tight">{t('app.title')}</span>
          </Link>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <nav className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="flex items-center gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('nav.solve')}
                </span>
                <NavLink to="/solve/2" className={navLink}>{t('nav.cube2')}</NavLink>
                <NavLink to="/solve/3" className={navLink}>{t('nav.cube3')}</NavLink>
                <NavLink to="/solve/4" className={navLink} end>{t('nav.cube4')}</NavLink>
              </span>
              <span className="hidden h-4 w-px bg-slate-200 sm:inline-block dark:bg-slate-700" />
              <span className="flex items-center gap-1">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                  {t('nav.learn')}
                </span>
                <NavLink to="/learn/2" className={navLink}>{t('nav.cube2')}</NavLink>
                <NavLink to="/learn/3" className={navLink}>{t('nav.cube3')}</NavLink>
              </span>
            </nav>
            <LocaleSwitcher />
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-slate-400">
        {t('app.footer.line', { year: new Date().getFullYear() })}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/solve/2" element={<SolvePage size={2} />} />
        <Route path="/solve/3" element={<SolvePage size={3} />} />
        <Route path="/solve/4" element={<SolvePage size={4} />} />
        <Route path="/learn/2" element={<TutorialPage size={2} />} />
        <Route path="/learn/3" element={<TutorialPage size={3} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
