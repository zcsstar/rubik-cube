import { Link } from 'react-router-dom';
import { Sparkles, Shuffle, BookOpen } from 'lucide-react';
import { Cube3x3 } from '@core/cube/Cube3x3';
import { CubeViewer3D } from '@ui/components/CubeViewer3D/CubeViewer3D';

const cards = [
  {
    title: 'Solve a 3×3',
    description: 'Scramble or paint your cube and get step-by-step moves.',
    href: '/solve/3',
    icon: Sparkles,
    primary: true,
  },
  {
    title: 'Solve a 2×2',
    description: 'Pocket cube — fast, beginner-friendly solutions.',
    href: '/solve/2',
    icon: Shuffle,
    primary: false,
  },
  {
    title: 'Solve a 4×4',
    description: 'Coming soon — reduction-method solver in development.',
    href: '/solve/4',
    icon: BookOpen,
    primary: false,
    disabled: true,
  },
];

export function HomePage() {
  // Show a static, slowly-rotated solved 3x3 as visual hero.
  const heroFacelets = Cube3x3.solved().toFaceletString();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium uppercase tracking-widest text-indigo-500">Cubist</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 lg:text-5xl">
            Solve any cube. Learn the patterns.
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">
            Drop in your cube state, get a clean step-by-step solution, and learn the
            beginner methods at your own pace. Free, in your browser, no sign-up.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              to="/solve/3"
              className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
            >
              Try the 3×3 solver
            </Link>
            <Link
              to="/solve/2"
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              Try the 2×2 solver
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <CubeViewer3D facelets={heroFacelets} size={3} className="aspect-square w-full" />
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => {
          const Icon = card.icon;
          const inner = (
            <div
              className={
                'flex h-full flex-col gap-2 rounded-xl border p-4 transition ' +
                (card.disabled
                  ? 'cursor-not-allowed border-slate-200 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900'
                  : card.primary
                    ? 'border-indigo-200 bg-indigo-50/40 hover:bg-indigo-50 dark:border-indigo-900 dark:bg-indigo-950/40 dark:hover:bg-indigo-950'
                    : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800')
              }
            >
              <Icon size={20} className="text-indigo-500" />
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {card.title}
              </h3>
              <p className="text-sm text-slate-600 dark:text-slate-300">{card.description}</p>
            </div>
          );
          if (card.disabled) return <div key={card.title}>{inner}</div>;
          return (
            <Link key={card.title} to={card.href}>
              {inner}
            </Link>
          );
        })}
      </section>
    </div>
  );
}
