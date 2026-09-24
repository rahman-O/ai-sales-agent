/**
 * Versioned deterministic chunking profile for P05.
 * Token estimate is Unicode-script aware (not raw char/4), stable across Node versions
 * that support Unicode property escapes.
 */
export const CHUNK_PROFILE_ID = 'chunk_v1' as const;

export const CHUNK_V1 = {
  profileId: CHUNK_PROFILE_ID,
  /** Target size per chunk. */
  targetTokens: 500,
  /** Overlap with previous chunk. */
  overlapTokens: 75,
  /** Hard maximum — chunks must not exceed this. */
  maxTokens: 800,
  /** Prefer merging crumbs below this into neighbors when possible. */
  minUsefulTokens: 20,
} as const;

/**
 * Deterministic token estimate for chunk_v1.
 * - Letter runs (any script, including Arabic) contribute ceil(len/8) (min 1)
 * - Number runs contribute ceil(len/4) (min 1)
 * - Punctuation/symbol atoms contribute 1 each
 * This is intentionally not the Qwen tokenizer; it is the versioned chunking contract.
 */
export function estimateTokensV1(text: string): number {
  const n = text.normalize('NFKC');
  if (!n.trim()) return 0;
  const parts = n.match(/\p{L}+|\p{N}+|\p{P}+|\p{S}+/gu) ?? [];
  if (parts.length === 0) {
    return Math.max(1, Math.ceil(n.trim().length / 8));
  }
  let tokens = 0;
  for (const p of parts) {
    if (/\p{L}/u.test(p[0]!)) {
      tokens += Math.max(1, Math.ceil(p.length / 8));
    } else if (/\p{N}/u.test(p[0]!)) {
      tokens += Math.max(1, Math.ceil(p.length / 4));
    } else {
      tokens += 1;
    }
  }
  return tokens;
}

type Unit = { text: string; tokens: number; isParaBreak: boolean };

function splitUnits(text: string): Unit[] {
  const normalized = text.replace(/\r\n/g, '\n').normalize('NFKC');
  const blocks = normalized.split(/\n{2,}/);
  const units: Unit[] = [];
  for (let b = 0; b < blocks.length; b++) {
    const block = blocks[b]!.trim();
    if (!block) continue;
    // Prefer sentence-ish boundaries, then whitespace runs.
    const pieces = block.split(/(?<=[.!?۔؟])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
    for (let i = 0; i < pieces.length; i++) {
      const t = pieces[i]!;
      const tok = estimateTokensV1(t);
      if (tok <= CHUNK_V1.maxTokens) {
        units.push({ text: t, tokens: tok, isParaBreak: i === pieces.length - 1 && b < blocks.length - 1 });
      } else {
        // Hard-split long unbroken units by character windows sized to maxTokens.
        let offset = 0;
        while (offset < t.length) {
          let lo = offset;
          let hi = t.length;
          let mid = hi;
          // Binary search end index with token <= maxTokens
          let best = offset + 1;
          while (lo <= hi) {
            mid = Math.floor((lo + hi) / 2);
            const slice = t.slice(offset, mid);
            const et = estimateTokensV1(slice);
            if (et <= CHUNK_V1.maxTokens) {
              best = mid;
              lo = mid + 1;
            } else {
              hi = mid - 1;
            }
          }
          if (best <= offset) best = Math.min(t.length, offset + 1);
          const slice = t.slice(offset, best).trim();
          if (slice) {
            units.push({
              text: slice,
              tokens: estimateTokensV1(slice),
              isParaBreak: false,
            });
          }
          offset = best;
        }
      }
    }
  }
  return units;
}

export type ChunkV1Result = {
  profileId: typeof CHUNK_PROFILE_ID;
  chunks: string[];
};

/**
 * Deterministic chunk_v1 splitter.
 * Identical input → identical chunks (stable ordinals and content).
 */
export function chunkTextV1(text: string): ChunkV1Result {
  const cleaned = text.replace(/\r\n/g, '\n').normalize('NFKC').trim();
  if (!cleaned) return { profileId: CHUNK_PROFILE_ID, chunks: [] };

  const totalTok = estimateTokensV1(cleaned);
  if (totalTok <= CHUNK_V1.targetTokens) {
    return { profileId: CHUNK_PROFILE_ID, chunks: [cleaned] };
  }

  const units = splitUnits(cleaned);
  if (!units.length) return { profileId: CHUNK_PROFILE_ID, chunks: [cleaned.slice(0, 1)] };

  const chunks: string[] = [];
  let i = 0;
  while (i < units.length) {
    let tokenSum = 0;
    let end = i;
    const parts: string[] = [];
    while (end < units.length) {
      const next = units[end]!;
      if (tokenSum > 0 && tokenSum + next.tokens > CHUNK_V1.targetTokens) {
        // Prefer ending at paragraph boundary if we already have useful content.
        break;
      }
      if (tokenSum + next.tokens > CHUNK_V1.maxTokens && tokenSum > 0) break;
      if (tokenSum === 0 && next.tokens > CHUNK_V1.maxTokens) {
        // Should not happen after splitUnits hard-split; force take.
        parts.push(next.text);
        end += 1;
        break;
      }
      parts.push(next.text);
      tokenSum += next.tokens;
      end += 1;
      if (tokenSum >= CHUNK_V1.targetTokens && next.isParaBreak) break;
      if (tokenSum >= CHUNK_V1.targetTokens) break;
    }
    if (!parts.length) {
      parts.push(units[i]!.text);
      end = i + 1;
    }
    let chunk = parts.join(' ').replace(/[ \t]+\n/g, '\n').trim();
    // Enforce hard max by trimming from end if estimate drifts.
    while (estimateTokensV1(chunk) > CHUNK_V1.maxTokens && chunk.length > 1) {
      chunk = chunk.slice(0, Math.floor(chunk.length * 0.9)).trim();
    }
    if (chunk) chunks.push(chunk);

    if (end >= units.length) break;
    // Overlap: walk back ~overlapTokens from end; always advance at least one unit.
    let backTokens = 0;
    let overlapStart = end;
    while (overlapStart > i && backTokens < CHUNK_V1.overlapTokens) {
      overlapStart -= 1;
      backTokens += units[overlapStart]!.tokens;
    }
    const next = Math.max(overlapStart, i + 1);
    i = next < end ? next : end;
  }

  // Drop empty; merge tiny trailing crumb into previous when below minUseful.
  const compact: string[] = [];
  for (const c of chunks) {
    if (!c) continue;
    const t = estimateTokensV1(c);
    if (
      compact.length &&
      t < CHUNK_V1.minUsefulTokens &&
      estimateTokensV1(compact[compact.length - 1]! + ' ' + c) <= CHUNK_V1.maxTokens
    ) {
      compact[compact.length - 1] = `${compact[compact.length - 1]} ${c}`.trim();
    } else {
      compact.push(c);
    }
  }

  return { profileId: CHUNK_PROFILE_ID, chunks: compact };
}

/** Alias used by ingest callers. */
export function chunkText(text: string): string[] {
  return chunkTextV1(text).chunks;
}
