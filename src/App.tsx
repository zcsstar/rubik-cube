import { Routes, Route, Link, NavLink } from 'react-router-dom';
import { HomePage } from '@ui/pages/HomePage';
import { SolvePage } from '@ui/pages/SolvePage';
import { TutorialPage } from '@ui/pages/TutorialPage';
import { NotFoundPage } from '@ui/pages/NotFoundPage';
import { Logo } from '@ui/components/Logo';
import { tutorial3x3Beginner } from '@core/tutorials/tutorial3x3Beginner';
import { tutorial2x2Beginner } from '@core/tutorials/tutorial2x2Beginner';

function Layout({ children }: { children: React.ReactNode }) {
  const navLink = ({ isActive }: { isActive: boolean }) =>
    'rounded-md px-2.5 py-1 text-sm font-medium transition ' +
    (isActive
      ? 'text-slate-900 dark:text-slate-50'
      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100');
  return (
    <div className="min-h-full flex flex-col">
      <header className="border-b border-slate-200 bg-white/70 backdrop-blur dark:border-slate-800 dark:bg-slate-950/70">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <Link to="/" className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
            <Logo size={26} />
            <span className="text-base font-semibold tracking-tight">Cubist</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="flex items-center gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Solve</span>
              <NavLink to="/solve/2" className={navLink}>2×2</NavLink>
              <NavLink to="/solve/3" className={navLink}>3×3</NavLink>
              <NavLink to="/solve/4" className={navLink} end>4×4</NavLink>
            </span>
            <span className="hidden h-4 w-px bg-slate-200 sm:inline-block dark:bg-slate-700" />
            <span className="flex items-center gap-1">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Learn</span>
              <NavLink to="/learn/2" className={navLink}>2×2</NavLink>
              <NavLink to="/learn/3" className={navLink}>3×3</NavLink>
            </span>
          </nav>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <footer className="mx-auto max-w-5xl px-4 py-6 text-center text-xs text-slate-400">
        Cubist · Rubik's Cube Solver · Cheez @{new Date().getFullYear()}
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route
          path="/solve/3"
          element={<SolvePage size={3} title="Solve a 3×3" description="Kociemba two-phase solver — solutions in 22 moves or fewer." />}
        />
        <Route
          path="/solve/2"
          element={<SolvePage size={2} title="Solve a 2×2" description="Pocket cube — solved by embedding into a 3×3 corner-only state." />}
        />
        <Route
          path="/solve/4"
          element={
            <div className="mx-auto max-w-md px-4 py-20 text-center">
              <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">4×4 — coming soon</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                Reduction-method solver is on the roadmap. The architecture supports it as a drop-in
                addition; only <code>Cube4x4</code> and <code>Solver4x4Reduction</code> need filling in.
              </p>
            </div>
          }
        />
        <Route path="/learn/3" element={<TutorialPage tutorial={tutorial3x3Beginner} />} />
        <Route path="/learn/2" element={<TutorialPage tutorial={tutorial2x2Beginner} />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Layout>
  );
}
