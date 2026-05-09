import { Link } from 'react-router-dom';
import { Sparkles, GraduationCap, Lock, Dumbbell } from 'lucide-react';
import type { CubeSize } from '@core/cube/ICube';
import { Cube3x3 } from '@core/cube/Cube3x3';
import { CubeViewer3D } from '@ui/components/CubeViewer3D/CubeViewer3D';
import { useI18n } from '@ui/i18n/I18nProvider';

interface CubeOffer {
  size: CubeSize;
  titleKey: string;
  descKey: string;
  disabled?: boolean;
  badgeKey?: string;
}

const cubeOffers: CubeOffer[] = [
  { size: 2, titleKey: 'home.cube2.title', descKey: 'home.cube2.description' },
  { size: 3, titleKey: 'home.cube3.title', descKey: 'home.cube3.description' },
  {
    size: 4,
    titleKey: 'home.cube4.title',
    descKey: 'home.cube4.description',
    disabled: true,
    badgeKey: 'home.cube4.badge',
  },
];

export function HomePage() {
  const { t } = useI18n();
  const heroFacelets = Cube3x3.solved().toFaceletString();
  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-10 px-4 py-10">
      <section className="grid items-center gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-3">
          <p className="text-sm font-medium uppercase tracking-widest text-indigo-500">{t('app.title')}</p>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-50 lg:text-5xl">
            {t('app.tagline')}
          </h1>
          <p className="text-base text-slate-600 dark:text-slate-300">{t('app.lead')}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Link
              to="/solve/3"
              className="rounded-md bg-indigo-500 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
            >
              {t('home.cta.solve')}
            </Link>
            <Link
              to="/learn/3"
              className="rounded-md border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              {t('home.cta.learn')}
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <CubeViewer3D facelets={heroFacelets} size={3} className="aspect-square w-full" />
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-50">{t('home.section.pick')}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {cubeOffers.map((offer) => (
            <CubeCard key={offer.size} offer={offer} />
          ))}
        </div>
      </section>
    </div>
  );
}

function CubeCard({ offer }: { offer: CubeOffer }) {
  const { t } = useI18n();
  const { size, titleKey, descKey, disabled, badgeKey } = offer;
  return (
    <div
      className={
        'flex h-full flex-col gap-3 rounded-xl border p-4 transition ' +
        (disabled
          ? 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900'
          : 'border-slate-200 bg-white hover:border-indigo-200 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-900')
      }
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{t(titleKey)}</h3>
        {badgeKey && (
          <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {t(badgeKey)}
          </span>
        )}
      </div>
      <p className="flex-1 text-sm text-slate-600 dark:text-slate-300">{t(descKey)}</p>
      <div className="flex flex-wrap gap-2">
        {disabled ? (
          <span className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm text-slate-400 dark:border-slate-700">
            <Lock size={14} /> {t('home.btn.comingSoon')}
          </span>
        ) : (
          <>
            <Link
              to={`/solve/${size}`}
              className="inline-flex items-center gap-1.5 rounded-md bg-indigo-500 px-3 py-1.5 text-sm font-medium text-white shadow-sm hover:bg-indigo-600"
            >
              <Sparkles size={14} /> {t('home.btn.solve')}
            </Link>
            <Link
              to={`/learn/${size}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <GraduationCap size={14} /> {t('home.btn.learn')}
            </Link>
            <Link
              to={`/practice/${size}`}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
            >
              <Dumbbell size={14} /> {t('home.btn.practice')}
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
