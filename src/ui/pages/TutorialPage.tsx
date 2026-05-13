import { useEffect, useMemo, useState } from 'react';
import type { Tutorial, TutorialCase } from '@core/tutorials/ITutorial';
import { getTutorial } from '@core/tutorials';
import { parseMoves, invertMoves } from '@core/cube/moves';
import { CubeViewer3D } from '@ui/components/CubeViewer3D/CubeViewer3D';
import { CubeMiniNet } from '@ui/components/CubeMiniNet/CubeMiniNet';
import { StepViewer } from '@ui/components/StepViewer/StepViewer';
import { MoveCard } from '@ui/components/MoveCard/MoveCard';
import { useAlgorithmPlayer } from '@ui/hooks/useAlgorithmPlayer';
import { Cube2x2 } from '@core/cube/Cube2x2';
import { Cube3x3 } from '@core/cube/Cube3x3';
import type { ICube, CubeSize } from '@core/cube/ICube';
import { useI18n } from '@ui/i18n/I18nProvider';
import { useBottomBanner } from '@/ads/useBottomBanner';
import { SizeSelector } from '@ui/components/SizeSelector/SizeSelector';

export interface TutorialPageProps {
  size: CubeSize;
}

function newSolved(size: CubeSize): ICube {
  if (size === 2) return Cube2x2.solved();
  if (size === 3) return Cube3x3.solved();
  throw new Error(`Unsupported size: ${size}`);
}

export function TutorialPage({ size }: TutorialPageProps) {
  const { locale, t } = useI18n();
  const tutorial = getTutorial(size, locale);

  if (!tutorial) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="text-2xl font-semibold text-slate-900 dark:text-slate-50">
          {t('notfound.title')}
        </h1>
      </div>
    );
  }

  return <TutorialBody tutorial={tutorial} />;
}

function TutorialBody({ tutorial }: { tutorial: Tutorial }) {
  const { t } = useI18n();
  useBottomBanner();
  const [stepId, setStepId] = useState<string>(() => tutorial.steps[0]!.id);
  const [caseId, setCaseId] = useState<string>(() => tutorial.steps[0]!.cases[0]!.id);

  // When tutorial swaps (e.g., locale change), re-anchor to the equivalent
  // step/case ids — they're stable across locales by design.
  useEffect(() => {
    if (!tutorial.steps.find((s) => s.id === stepId)) {
      setStepId(tutorial.steps[0]!.id);
      setCaseId(tutorial.steps[0]!.cases[0]!.id);
    }
  }, [tutorial, stepId]);

  const step = tutorial.steps.find((s) => s.id === stepId) ?? tutorial.steps[0]!;
  const activeCase = step.cases.find((c) => c.id === caseId) ?? step.cases[0]!;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-6 lg:py-10">
      <header className="flex flex-col gap-2">
        <SizeSelector section="learn" sizes={[2, 3]} />
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
          {tutorial.title}
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">{tutorial.blurb}</p>
      </header>

      <StepNav
        steps={tutorial.steps}
        activeId={stepId}
        onChange={(id) => {
          setStepId(id);
          const target = tutorial.steps.find((s) => s.id === id);
          if (target) setCaseId(target.cases[0]!.id);
        }}
      />

      <section className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-500">
            {t('tutorial.step')} {step.number}
          </div>
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-50">{step.title}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{step.goal}</p>
        </div>
        <p className="whitespace-pre-line text-sm text-slate-700 dark:text-slate-200">{step.intro}</p>
        {step.tips && step.tips.length > 0 && (
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600 dark:text-slate-300">
            {step.tips.map((t, i) => (
              <li key={i}>{t}</li>
            ))}
          </ul>
        )}
      </section>

      <CaseDemo size={tutorial.size} caseData={activeCase} key={`${stepId}-${activeCase.id}`} />

      {step.cases.length > 1 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold tracking-wide text-slate-700 dark:text-slate-200">
            {t('tutorial.casesInStep')}
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {step.cases.map((c) => (
              <CaseCard
                key={c.id}
                caseData={c}
                size={tutorial.size}
                active={c.id === activeCase.id}
                onClick={() => setCaseId(c.id)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function StepNav({
  steps,
  activeId,
  onChange,
}: {
  steps: Tutorial['steps'];
  activeId: string;
  onChange: (id: string) => void;
}) {
  return (
    <nav className="flex flex-wrap gap-1.5">
      {steps.map((s) => {
        const active = s.id === activeId;
        return (
          <button
            key={s.id}
            type="button"
            onClick={() => onChange(s.id)}
            className={
              'flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm transition ' +
              (active
                ? 'border-indigo-500 bg-indigo-500 text-white shadow-sm'
                : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800')
            }
          >
            <span
              className={
                'flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ' +
                (active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300')
              }
            >
              {s.number}
            </span>
            {s.title}
          </button>
        );
      })}
    </nav>
  );
}

function CaseCard({
  caseData,
  size,
  active,
  onClick,
}: {
  caseData: TutorialCase;
  size: CubeSize;
  active: boolean;
  onClick: () => void;
}) {
  const facelets = useMemo(() => {
    const setup = caseData.setup
      ? parseMoves(caseData.setup)
      : invertMoves(parseMoves(caseData.algorithm));
    return newSolved(size).applyAll(setup).toFaceletString();
  }, [size, caseData.algorithm, caseData.setup]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'flex w-full flex-col items-start gap-2 rounded-xl border p-3 text-left transition ' +
        (active
          ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/30'
          : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800')
      }
    >
      <CubeMiniNet facelets={facelets} size={size} width={120} />
      <div className="text-sm font-medium text-slate-900 dark:text-slate-50">{caseData.name}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400">{caseData.description}</div>
    </button>
  );
}

function CaseDemo({ caseData, size }: { caseData: TutorialCase; size: CubeSize }) {
  const { t } = useI18n();
  const algorithm = useMemo(() => parseMoves(caseData.algorithm), [caseData.algorithm]);
  const setup = useMemo(
    () => (caseData.setup ? parseMoves(caseData.setup) : invertMoves(algorithm)),
    [caseData.setup, algorithm],
  );
  const player = useAlgorithmPlayer(size, setup, algorithm);

  return (
    <section className="grid gap-4 lg:grid-cols-2">
      <div className="flex flex-col gap-3">
        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-3 shadow-sm dark:border-slate-800 dark:from-slate-900 dark:to-slate-950">
          <CubeViewer3D
            facelets={player.cube.toFaceletString()}
            size={size}
            animation={player.animating}
            onAnimationEnd={player.finishAnimation}
            className="aspect-square w-full"
          />
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          <button
            type="button"
            onClick={player.reset}
            className="rounded-md border border-slate-200 px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800"
          >
            {t('tutorial.btn.resetCase')}
          </button>
          {caseData.recognition && (
            <p className="text-xs italic text-slate-500 dark:text-slate-400">{caseData.recognition}</p>
          )}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div className="rounded-xl border border-indigo-200 bg-indigo-50/40 p-3 dark:border-indigo-900 dark:bg-indigo-950/30">
          <div className="text-xs font-semibold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
            {t('tutorial.algorithmLabel')}
          </div>
          <div className="mt-1 text-base font-semibold text-slate-900 dark:text-slate-50">
            {caseData.name}
          </div>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-200">{caseData.description}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {algorithm.map((m, i) => (
              <MoveCard key={i} move={m} variant="small" />
            ))}
          </div>
        </div>
        <StepViewer
          moves={algorithm}
          currentStep={player.step}
          playing={player.playing}
          animating={!!player.animating}
          onStepChange={player.requestStep}
          onPlayingChange={player.setPlaying}
          titleKey="player.title.walk"
        />
      </div>
    </section>
  );
}
