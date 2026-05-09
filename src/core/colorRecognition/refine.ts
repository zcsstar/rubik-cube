import type { FaceLetter } from '../cube/colors';

interface RGB {
  r: number;
  g: number;
  b: number;
}

interface Sample {
  faceIndex: number; // 0..5 in URFDLB order
  patchIndex: number; // 0..(N*N-1)
  rgb: RGB;
}

const URFDLB_FACES: readonly FaceLetter[] = ['U', 'R', 'F', 'D', 'L', 'B'] as const;

/** WCA reference hex values, in URFDLB order. Used as K-means seed centroids. */
const WCA_RGB_REFS: RGB[] = [
  { r: 255, g: 255, b: 255 }, // U white
  { r: 238, g: 0, b: 0 }, // R red
  { r: 0, g: 176, b: 75 }, // F green
  { r: 255, g: 213, b: 0 }, // D yellow
  { r: 255, g: 111, b: 0 }, // L orange
  { r: 26, g: 102, b: 255 }, // B blue
];

function distSq(a: RGB, b: RGB): number {
  const dr = a.r - b.r;
  const dg = a.g - b.g;
  const db = a.b - b.b;
  return dr * dr + dg * dg + db * db;
}

function avg(rgbs: RGB[]): RGB {
  if (rgbs.length === 0) return { r: 0, g: 0, b: 0 };
  let r = 0, g = 0, b = 0;
  for (const c of rgbs) {
    r += c.r;
    g += c.g;
    b += c.b;
  }
  return { r: r / rgbs.length, g: g / rgbs.length, b: b / rgbs.length };
}

/**
 * K-means refinement over all camera-captured patches at once. Seeds the
 * k=6 cluster centroids with the canonical WCA RGB values, runs a fixed
 * number of iterations, then re-labels every patch by its closest cluster.
 *
 * The big win over per-patch nearest-neighbour is consistency: if a single
 * face was captured under noticeably warmer light, all of its samples shift
 * together, and the clustering step keeps them grouped — a stray "mostly
 * red but a bit dim" patch isn't likely to flip to orange.
 *
 * Cluster-to-face assignment: K-means uses the WCA reference order as the
 * initial centroids, and we keep the centroids' index aligned with that
 * order (so cluster 0 = white, 1 = red, …). Even after centroid migration
 * the closest WCA reference to each centroid almost always stays the same;
 * we explicitly re-anchor at the end as a safety net.
 */
export function refineWithKMeans(
  samples: Sample[],
  iterations = 8,
): Map<string, FaceLetter> {
  // Initialise centroids from WCA references.
  let centroids = WCA_RGB_REFS.map((c) => ({ ...c }));

  for (let iter = 0; iter < iterations; iter++) {
    const buckets: RGB[][] = Array.from({ length: 6 }, () => []);
    for (const s of samples) {
      let best = 0;
      let bestDist = Infinity;
      for (let i = 0; i < 6; i++) {
        const d = distSq(s.rgb, centroids[i]!);
        if (d < bestDist) {
          bestDist = d;
          best = i;
        }
      }
      buckets[best]!.push(s.rgb);
    }
    centroids = centroids.map((prev, i) => (buckets[i]!.length === 0 ? prev : avg(buckets[i]!)));
  }

  // Anchor centroids back to WCA references by greedy assignment: for each
  // WCA reference, find the centroid that's closest to it. Guarantees we
  // don't lose a label if the centroids wandered.
  const anchor = new Array<number>(6).fill(-1);
  const used = new Array<boolean>(6).fill(false);
  for (let ref = 0; ref < 6; ref++) {
    let bestC = -1;
    let bestDist = Infinity;
    for (let c = 0; c < 6; c++) {
      if (used[c]) continue;
      const d = distSq(WCA_RGB_REFS[ref]!, centroids[c]!);
      if (d < bestDist) {
        bestDist = d;
        bestC = c;
      }
    }
    anchor[ref] = bestC;
    if (bestC >= 0) used[bestC] = true;
  }

  // Final classification: for each sample, pick the centroid (in anchored
  // order) whose RGB is closest. anchor[ref] gives the centroid index that
  // represents face URFDLB[ref].
  const out = new Map<string, FaceLetter>();
  for (const s of samples) {
    let best = 0;
    let bestDist = Infinity;
    for (let ref = 0; ref < 6; ref++) {
      const cIdx = anchor[ref]!;
      if (cIdx < 0) continue;
      const d = distSq(s.rgb, centroids[cIdx]!);
      if (d < bestDist) {
        bestDist = d;
        best = ref;
      }
    }
    out.set(`${s.faceIndex},${s.patchIndex}`, URFDLB_FACES[best]!);
  }
  return out;
}

export type { RGB, Sample };
