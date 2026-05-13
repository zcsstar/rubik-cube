import { Suspense, lazy } from 'react';
import { Routes, Route, Link } from 'react-router-dom';
import { Logo } from '@ui/components/Logo';
import { LocaleSwitcher } from '@ui/components/LocaleSwitcher/LocaleSwitcher';
import { BottomTabBar } from '@ui/components/BottomTabBar/BottomTabBar';
import { useI18n } from '@ui/i18n/I18nProvider';

const HomePage = lazy(() =>
  import('@ui/pages/HomePage').then((m) => ({ default: m.HomePage })),
);
const SolvePage = lazy(() =>
  import('@ui/pages/SolvePage').then((m) => ({ default: m.SolvePage })),
);
const TutorialPage = lazy(() =>
  import('@ui/pages/TutorialPage').then((m) => ({ default: m.TutorialPage })),
);
const PracticePage = lazy(() =>
  import('@ui/pages/PracticePage').then((m) => ({ default: m.PracticePage })),
);
const NotFoundPage = lazy(() =>
  import('@ui/pages/NotFoundPage').then((m) => ({ default: m.NotFoundPage })),
);
const PrivacyPage = lazy(() =>
  import('@ui/pages/PrivacyPage').then((m) => ({ default: m.PrivacyPage })),
);

function PageFallback() {
  return <div className="mx-auto max-w-5xl px-4 py-10" aria-busy="true" />;
}

function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useI18n();
  return (
    <div className="min-h-full flex flex-col">
      <header
        className="sticky top-0 z-20 border-b border-slate-200 bg-white/85 backdrop-blur dark:border-slate-800 dark:bg-slate-950/85"
        style={{ paddingTop: 'var(--safe-top)' }}
      >
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5">
          <Link
            to="/"
            className="flex items-center gap-2 text-slate-900 dark:text-slate-50"
            aria-label={t('app.title')}
          >
            <Logo size={28} />
            <span className="text-base font-semibold tracking-tight">{t('app.title')}</span>
          </Link>
          <LocaleSwitcher />
        </div>
      </header>
      <main className="flex-1">
        <Suspense fallback={<PageFallback />}>{children}</Suspense>
      </main>
      <footer className="mx-auto flex max-w-5xl flex-col items-center gap-1 px-4 py-6 text-center text-xs text-slate-400">
        <span>{t('app.footer.line', { year: new Date().getFullYear() })}</span>
        <Link
          to="/privacy"
          className="text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300"
        >
          {t('app.footer.privacy')}
        </Link>
      </footer>
      <BottomTabBar />
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
        <Route path="/practice/2" element={<PracticePage size={2} />} />
        <Route path="/practice/3" element={<PracticePage size={3} />} />
        <Route path="/privacy" element={<PrivacyPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
