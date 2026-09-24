/** Cosine distance in [0, 2] for unit vectors ≈ 1 - cosine_similarity. */
export function cosineDistance(a: number[], b: number[]): number {
  if (a.length !== b.length) throw new Error('dim_mismatch');
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    na += a[i]! * a[i]!;
    nb += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb) || 1;
  const sim = Math.min(1, Math.max(-1, dot / denom));
  return 1 - sim;
}

export function similarityFromDistance(distance: number): number {
  return 1 - distance;
}

export function hitAtK(rankedIds: string[], relevant: string[], k: number): boolean {
  if (!relevant.length) return false;
  const top = new Set(rankedIds.slice(0, k));
  return relevant.some((id) => top.has(id));
}

export function reciprocalRank(rankedIds: string[], relevant: string[]): number {
  if (!relevant.length) return 0;
  const rel = new Set(relevant);
  for (let i = 0; i < rankedIds.length; i++) {
    if (rel.has(rankedIds[i]!)) return 1 / (i + 1);
  }
  return 0;
}
