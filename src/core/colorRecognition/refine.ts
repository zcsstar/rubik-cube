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

/**
 * Same K-means but enforces a per-colour sticker-count constraint at the
 * assignment step. After centroids converge, each sticker is assigned to
 * exactly one cluster — but the assignment is solved as a balanced
 * transportation problem so that cluster `c` ends up holding exactly
 * `expectedCounts[c]` stickers (4 for 2×2 / 9 for 3×3 / 16 for 4×4, minus
 * any user-locked overrides).
 *
 * Why: unconstrained K-means is greedy per-sticker, so a single borderline
 * red sticker can get pulled into the orange cluster under warm light —
 * leaving R with 3 and L with 5 on a 2×2 capture. That's a count error the
 * downstream resolver / validator can't recover from. With the constraint
 * we force balanced counts and only ever flip the *least confident* stickers
 * between clusters.
 *
 * Implementation: sorted-pair greedy initial assignment, then iterative
 * pairwise-swap local improvement. Trivially fast at our scale (≤54
 * stickers × 6 colours). Falls back to the unconstrained classifier if the
 * caller's totals don't add up.
 */
export function refineWithKMeansConstrained(
  samples: Sample[],
  expectedCounts: Record<FaceLetter, number>,
  iterations = 8,
): Map<string, FaceLetter> {
  let total = 0;
  for (const f of URFDLB_FACES) total += expectedCounts[f] ?? 0;
  if (total !== samples.length || samples.length === 0) {
    return refineWithKMeans(samples, iterations);
  }

  // K-means iteration to get final centroids.
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

  // Anchor centroids back to WCA references (so cluster index aligns with
  // face letter). Greedy nearest-match with no re-use.
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

  // Cost matrix: cost[s][face] = distance² from sample to the centroid that
  // represents that face.
  const cost: number[][] = samples.map((s) =>
    URFDLB_FACES.map((_f, ref) => distSq(s.rgb, centroids[anchor[ref]!]!)),
  );

  // Initial assignment via sorted-pair greedy: process all (sample, face)
  // pairs cheapest-first, assigning when both the sample is unassigned and
  // the face still has capacity. Produces valid counts; may not be globally
  // optimal — local swap pass cleans up.
  const remaining = new Array<number>(6);
  for (let ref = 0; ref < 6; ref++) remaining[ref] = expectedCounts[URFDLB_FACES[ref]!]!;
  const assigned = new Array<number>(samples.length).fill(-1);
  const pairs: { sIdx: number; ref: number; cost: number }[] = [];
  for (let s = 0; s < samples.length; s++) {
    for (let ref = 0; ref < 6; ref++) {
      pairs.push({ sIdx: s, ref, cost: cost[s]![ref]! });
    }
  }
  pairs.sort((a, b) => a.cost - b.cost);
  let unassigned = samples.length;
  for (const p of pairs) {
    if (unassigned === 0) break;
    if (assigned[p.sIdx] !== -1) continue;
    if (remaining[p.ref]! <= 0) continue;
    assigned[p.sIdx] = p.ref;
    remaining[p.ref]!--;
    unassigned--;
  }

  // Local improvement: any pairwise swap that reduces total cost is taken.
  // Counts stay balanced because swaps trade one assignment for another.
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < samples.length; i++) {
      for (let j = i + 1; j < samples.length; j++) {
        const ri = assigned[i]!;
        const rj = assigned[j]!;
        if (ri === rj) continue;
        const before = cost[i]![ri]! + cost[j]![rj]!;
        const after = cost[i]![rj]! + cost[j]![ri]!;
        if (after + 1e-9 < before) {
          assigned[i] = rj;
          assigned[j] = ri;
          improved = true;
        }
      }
    }
  }

  const out = new Map<string, FaceLetter>();
  for (let s = 0; s < samples.length; s++) {
    out.set(`${samples[s]!.faceIndex},${samples[s]!.patchIndex}`, URFDLB_FACES[assigned[s]!]!);
  }
  return out;
}

export type { RGB, Sample };
