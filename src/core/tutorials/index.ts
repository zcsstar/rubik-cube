import type { CubeSize } from '../cube/ICube';
import type { Locale } from '../i18n';
import type { Tutorial } from './ITutorial';
import { tutorial3x3Beginner } from './tutorial3x3Beginner';
import { tutorial3x3Beginner_zh } from './tutorial3x3Beginner.zh';
import { tutorial2x2Beginner } from './tutorial2x2Beginner';
import { tutorial2x2Beginner_zh } from './tutorial2x2Beginner.zh';

const tutorials: Record<2 | 3, Record<Locale, Tutorial>> = {
  2: {
    en: tutorial2x2Beginner,
    zh: tutorial2x2Beginner_zh,
  },
  3: {
    en: tutorial3x3Beginner,
    zh: tutorial3x3Beginner_zh,
  },
};

/**
 * Resolve the localised tutorial for a given cube size. 4×4 has no tutorial yet.
 * Falls back to English if the requested locale is missing.
 */
export function getTutorial(size: CubeSize, locale: Locale): Tutorial | null {
  if (size !== 2 && size !== 3) return null;
  const bySize = tutorials[size];
  return bySize[locale] ?? bySize.en;
}

export type { Tutorial, TutorialStep, TutorialCase } from './ITutorial';
