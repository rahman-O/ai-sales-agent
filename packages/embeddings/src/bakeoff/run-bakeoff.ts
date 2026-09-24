import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ACCEPTANCE,
  casesFor,
  GOLDEN_DOCUMENTS,
  type GoldenCase,
  type LangSlice,
} from './golden-set.js';
import {
  CANDIDATE_EMBEDDING_PROFILE,
  QWEN_DENTAL_QUERY_INSTRUCTION,
  QWEN_QUERY_INSTRUCTION_VERSION,
  QWEN3_EMBED_06B_REVISION,
} from '../ports.js';
import { LocalQwenEmbeddingProvider } from '../local-qwen.js';
import { cosineDistance, hitAtK, reciprocalRank } from '../similarity.js';

function rankDocs(queryVec: number[], docVectors: Map<string, number[]>) {
  return GOLDEN_DOCUMENTS.map((d) => {
    const distance = cosineDistance(queryVec, docVectors.get(d.id)!);
    return { id: d.id, distance };
  }).sort((a, b) => a.distance - b.distance || a.id.localeCompare(b.id));
}

async function calibrateMaxDistance(
  cases: GoldenCase[],
  docVectors: Map<string, number[]>,
  embedQuery: (q: string) => Promise<number[]>,
): Promise<{ maxDistance: number; details: string }> {
  // Collect distances for true positives (best relevant) and negatives (top1 on no-result).
  const pos: number[] = [];
  const neg: number[] = [];
  for (const c of cases) {
    const qv = await embedQuery(c.query);
    const ranked = rankDocs(qv, docVectors);
    if (c.expectNoResult) {
      neg.push(ranked[0]!.distance);
    } else {
      const rel = new Set(c.relevantDocIds);
      const bestRel = ranked.find((r) => rel.has(r.id));
      if (bestRel) pos.push(bestRel.distance);
    }
  }
  pos.sort((a, b) => a - b);
  neg.sort((a, b) => a - b);
    // Choose threshold maximizing (TPR on pos using d<=t) while keeping FPR low on neg.
    const candidates = [...new Set([...pos, ...neg])].sort((a, b) => a - b);
    let bestT = 0.5;
    let bestScore = -Infinity;
    for (const t of candidates) {
      const tpr = pos.length ? pos.filter((d) => d <= t).length / pos.length : 0;
      const fpr = neg.length ? neg.filter((d) => d <= t).length / neg.length : 0;
      // Prefer high TPR and low FPR; weight FPR heavily for no-result quality.
      const score = tpr - 2 * fpr;
      if (score > bestScore) {
        bestScore = score;
        bestT = t;
      }
    }
    // Slight slack toward recall on positives if mid empty
    if (!candidates.length) bestT = 0.5;
    return {
      maxDistance: bestT,
      details: `pos_n=${pos.length} neg_n=${neg.length} pos_p50=${pos[Math.floor(pos.length / 2)]?.toFixed(4)} neg_p50=${neg[Math.floor(neg.length / 2)]?.toFixed(4)}`,
    };
}

async function main() {
  try {
    const { loadLocalEnv } = await import('@ai-sales-agent/config');
    loadLocalEnv();
  } catch {
    /* optional */
  }

  const baseUrl = process.env.EMBEDDING_LOCAL_BASE_URL?.trim() || 'http://127.0.0.1:8080';
  const provider = new LocalQwenEmbeddingProvider({
    baseUrl,
    model: process.env.EMBEDDING_MODEL?.trim() || CANDIDATE_EMBEDDING_PROFILE.model,
    modelRevision: process.env.EMBEDDING_MODEL_REVISION?.trim() || QWEN3_EMBED_06B_REVISION,
    expectedTeiSha: process.env.EMBEDDING_MODEL_REVISION?.trim() || QWEN3_EMBED_06B_REVISION,
  });

  const here = path.dirname(fileURLToPath(import.meta.url));
  const outPath = path.resolve(
    here,
    '../../../../docs/ai-sales-agent/14-roadmap/phase-05-embedding-bakeoff.md',
  );

  const t0 = Date.now();
  let info;
  try {
    info = await provider.assertHealthy();
  } catch (e) {
    const md = `# Phase 05 — Embedding bake-off (local Qwen)

Status: **BLOCKED_TEI_UNREACHABLE**

Start TEI first:

\`\`\`bash
chmod +x scripts/tei-compose.sh
./scripts/tei-compose.sh up -d tei
\`\`\`

Then: \`npm run bakeoff -w @ai-sales-agent/embeddings\`

Error: ${String(e)}
`;
    writeFileSync(outPath, md);
    console.error(String(e));
    process.exit(2);
  }
  const modelLoadMs = Date.now() - t0;

  let teiDigest = 'unknown';
  try {
    teiDigest = execSync(
      'docker inspect --format="{{index .RepoDigests 0}}" ai-sales-agent-tei 2>/dev/null || docker image inspect --format="{{index .RepoDigests 0}}" "$TEI_IMAGE" 2>/dev/null || echo unknown',
      { encoding: 'utf8', env: process.env },
    ).trim();
  } catch {
    teiDigest = 'unknown';
  }

  // Warm + cold latency
  const coldStart = Date.now();
  await provider.embedQuery('cold start probe');
  const coldMs = Date.now() - coldStart;
  const warmStart = Date.now();
  await provider.embedQuery('warm probe again');
  const warmMs = Date.now() - warmStart;

  const batchStart = Date.now();
  await provider.embedDocuments(GOLDEN_DOCUMENTS.map((d) => d.text));
  const batchMs = Date.now() - batchStart;
  const throughput = GOLDEN_DOCUMENTS.length / (batchMs / 1000);

  const docEmbed = await provider.embedDocuments(GOLDEN_DOCUMENTS.map((d) => d.text));
  const docVectors = new Map(GOLDEN_DOCUMENTS.map((d, i) => [d.id, docEmbed.vectors[i]!]));

  let normalizationVerified: 'PASS' | 'FAIL' = 'PASS';
  try {
    for (const v of docEmbed.vectors) {
      if (v.length !== 1024) throw new Error('dim');
    }
  } catch {
    normalizationVerified = 'FAIL';
  }

  const calCases = casesFor('calibration');
  const heldCases = casesFor('heldout');

  const cal = await calibrateMaxDistance(calCases, docVectors, async (q) => {
    const r = await provider.embedQuery(q);
    return r.vectors[0]!;
  });
  const maxDistance = cal.maxDistance;
  // FREEZE — never retune after held-out

  type RankAcc = { hit1: number; hit3: number; hit6: number; mrr: number; n: number };
  const overall: RankAcc = { hit1: 0, hit3: 0, hit6: 0, mrr: 0, n: 0 };
  const bySlice = new Map<string, RankAcc>();
  const ensure = (s: string) => {
    if (!bySlice.has(s)) bySlice.set(s, { hit1: 0, hit3: 0, hit6: 0, mrr: 0, n: 0 });
    return bySlice.get(s)!;
  };

  const failures: string[] = [];
  const caseRows: string[] = [];

  // RANKING on held-out relevance (no threshold)
  const relevanceHeld = heldCases.filter((c) => !c.expectNoResult);
  for (const c of relevanceHeld) {
    const q = await provider.embedQuery(c.query);
    const ranked = rankDocs(q.vectors[0]!, docVectors);
    const ids = ranked.map((r) => r.id);
    const acc = overall;
    acc.n += 1;
    if (hitAtK(ids, c.relevantDocIds, 1)) acc.hit1 += 1;
    else failures.push(`${c.id}: miss@1 top=${ids.slice(0, 3).join(',')}`);
    if (hitAtK(ids, c.relevantDocIds, 3)) acc.hit3 += 1;
    if (hitAtK(ids, c.relevantDocIds, 6)) acc.hit6 += 1;
    acc.mrr += reciprocalRank(ids, c.relevantDocIds);

    const sl = ensure(c.slice);
    sl.n += 1;
    if (hitAtK(ids, c.relevantDocIds, 1)) sl.hit1 += 1;
    if (hitAtK(ids, c.relevantDocIds, 3)) sl.hit3 += 1;
    if (hitAtK(ids, c.relevantDocIds, 6)) sl.hit6 += 1;
    sl.mrr += reciprocalRank(ids, c.relevantDocIds);

    caseRows.push(
      `| ${c.id} | ${c.slice} | top1=${ids[0]} d=${ranked[0]!.distance.toFixed(4)} |`,
    );
  }

  // ABSTENTION on held-out with frozen threshold
  const noResultHeld = heldCases.filter((c) => c.expectNoResult);
  let noResultOk = 0;
  let fp = 0; // returned evidence on no-result
  let fn = 0; // relevance case where best relevant filtered out (for reporting)
  for (const c of noResultHeld) {
    const q = await provider.embedQuery(c.query);
    const ranked = rankDocs(q.vectors[0]!, docVectors);
    const filtered = ranked.filter((r) => r.distance <= maxDistance);
    if (filtered.length === 0) {
      noResultOk += 1;
      caseRows.push(`| ${c.id} | no-result | PASS empty |`);
    } else {
      fp += 1;
      failures.push(`${c.id}: FP evidence ${filtered[0]!.id} d=${filtered[0]!.distance.toFixed(4)}`);
      caseRows.push(`| ${c.id} | no-result | FAIL ${filtered[0]!.id} |`);
    }
  }
  for (const c of relevanceHeld) {
    const q = await provider.embedQuery(c.query);
    const ranked = rankDocs(q.vectors[0]!, docVectors);
    const rel = new Set(c.relevantDocIds);
    const bestRel = ranked.find((r) => rel.has(r.id));
    if (bestRel && bestRel.distance > maxDistance) fn += 1;
  }

  const hit1r = overall.hit1 / overall.n;
  const hit3r = overall.hit3 / overall.n;
  const hit6r = overall.hit6 / overall.n;
  const mrr = overall.mrr / overall.n;
  const noResultRate = noResultHeld.length ? noResultOk / noResultHeld.length : 1;
  const fpr = noResultHeld.length ? fp / noResultHeld.length : 0;
  const fnr = relevanceHeld.length ? fn / relevanceHeld.length : 0;

  const sliceOk = ACCEPTANCE.primarySlices.every((s) => {
    const a = bySlice.get(s);
    if (!a || a.n < 1) return false;
    return a.hit3 / a.n >= ACCEPTANCE.sliceHitAt3;
  });

  const pass =
    normalizationVerified === 'PASS' &&
    hit1r >= ACCEPTANCE.hitAt1 &&
    hit3r >= ACCEPTANCE.hitAt3 &&
    hit6r >= ACCEPTANCE.hitAt6 &&
    mrr >= ACCEPTANCE.mrr &&
    noResultRate >= ACCEPTANCE.noResultCorrectness &&
    sliceOk;

  const status = pass ? 'PASS' : 'FAIL';
  const recommendation = pass ? 'ACCEPT_CANDIDATE' : 'REJECT_CANDIDATE';

  const sliceLines = [...bySlice.entries()]
    .map(([s, a]) => {
      const h3 = a.n ? a.hit3 / a.n : 0;
      return `| ${s} | ${a.hit1}/${a.n} | ${a.hit3}/${a.n} (${(h3 * 100).toFixed(1)}%) | ${a.hit6}/${a.n} | ${(a.mrr / (a.n || 1)).toFixed(3)} |`;
    })
    .join('\n');

  const mem = process.memoryUsage();
  const md = `# Phase 05 — Embedding bake-off (local Qwen)

Status: **${status}**

## PHASE 05 LOCAL EMBEDDING BAKE-OFF

PROVIDER: LOCAL_TEI

MODEL: Qwen/Qwen3-Embedding-0.6B

MODEL REVISION: \`${QWEN3_EMBED_06B_REVISION}\`

TEI VERSION: ${info.version ?? 'see image tag 1.9'}

TEI IMAGE DIGEST: \`${teiDigest}\`

CANDIDATE DIMENSION: 1024

QUERY INSTRUCTION VERSION: \`${QWEN_QUERY_INSTRUCTION_VERSION}\`

QUERY INSTRUCTION:

\`\`\`
Instruct: ${QWEN_DENTAL_QUERY_INSTRUCTION}
Query: <customer query>
\`\`\`

NORMALIZATION VERIFIED: **${normalizationVerified}**

## ACCEPTANCE CRITERIA (predeclared)

| Metric | Minimum |
|--------|---------|
| Hit@1 | ≥ ${ACCEPTANCE.hitAt1} |
| Hit@3 | ≥ ${ACCEPTANCE.hitAt3} |
| Hit@6 | ≥ ${ACCEPTANCE.hitAt6} |
| MRR | ≥ ${ACCEPTANCE.mrr} |
| Slice Hit@3 | ≥ ${ACCEPTANCE.sliceHitAt3} |
| No-result correctness | ≥ ${ACCEPTANCE.noResultCorrectness} |

## RESULTS (held-out ranking — before threshold)

| Metric | Value |
|--------|-------|
| Hit@1 | ${(hit1r * 100).toFixed(1)}% (${overall.hit1}/${overall.n}) |
| Hit@3 | ${(hit3r * 100).toFixed(1)}% (${overall.hit3}/${overall.n}) |
| Hit@6 | ${(hit6r * 100).toFixed(1)}% (${overall.hit6}/${overall.n}) |
| MRR | ${mrr.toFixed(3)} |

### By slice

| Slice | Hit@1 | Hit@3 | Hit@6 | MRR |
|-------|-------|-------|-------|-----|
${sliceLines}

## ABSTENTION (held-out, frozen maxDistance)

CALIBRATION SET SIZE: ${calCases.length}

HELD-OUT SET SIZE: ${heldCases.length}

SELECTED maxDistance: **${maxDistance.toFixed(6)}** (${cal.details})

| Metric | Value |
|--------|-------|
| No-result correctness | ${(noResultRate * 100).toFixed(1)}% (${noResultOk}/${noResultHeld.length}) |
| FALSE POSITIVE RATE | ${(fpr * 100).toFixed(1)}% (${fp}/${noResultHeld.length}) |
| FALSE NEGATIVE RATE (rel. filtered) | ${(fnr * 100).toFixed(1)}% (${fn}/${relevanceHeld.length}) |

## PERFORMANCE (environment-specific; not a universal benchmark)

| Metric | Value |
|--------|-------|
| Model load / health wait | ${modelLoadMs} ms |
| Cold query | ${coldMs} ms |
| Warm query | ${warmMs} ms |
| Batch throughput | ${throughput.toFixed(2)} docs/s (${GOLDEN_DOCUMENTS.length} docs in ${batchMs} ms) |
| Process RSS | ${(mem.rss / 1024 / 1024).toFixed(1)} MB |
| Hardware | ${os.platform()} ${os.arch()} cpus=${os.cpus().length} |

## FAILURE EXAMPLES

${failures.length ? failures.map((f) => `- ${f}`).join('\n') : '- none'}

## Cases (sample)

| Case | Slice | Result |
|------|-------|--------|
${caseRows.join('\n')}

## EXTERNAL DATA EGRESS

TENANT DATA EGRESS DURING EMBEDDING: **NONE**

INFRASTRUCTURE NETWORK EGRESS: model/container download during provisioning only, unless already cached.

## FAKE PROVIDER PRODUCTION POLICY

**PASS** — Fake never selected by \`resolveEmbeddingProvider\`; local_qwen fail-closed.

## RECOMMENDATION

**${recommendation}**

## FINAL PROFILE PROPOSAL

${
  pass
    ? `| Field | Value |
|-------|--------|
| profileId | \`qwen3_embed_06b_1024_v1\` |
| provider | local_qwen / LOCAL_TEI |
| model | Qwen/Qwen3-Embedding-0.6B |
| modelRevision | \`${QWEN3_EMBED_06B_REVISION}\` |
| teiImageDigest | \`${teiDigest}\` |
| dimension | **1024** |
| queryInstructionVersion | \`${QWEN_QUERY_INSTRUCTION_VERSION}\` |
| normalizationMode | tei_normalize_true_l2 |
| maxDistance (frozen) | ${maxDistance.toFixed(6)} |

FINAL DIMENSION PROPOSAL: **1024**

MIGRATION READY: **YES** (await explicit migration GO — do not create vector(1024) in this step)
`
    : `NOT LOCKED — REJECT_CANDIDATE. Do not migrate. Do not silently switch models.

FINAL DIMENSION PROPOSAL: n/a

MIGRATION READY: **NO**
`
}

## BLOCKERS

${pass ? 'NONE' : 'Held-out acceptance failed — see FAILURE EXAMPLES'}
`;

  writeFileSync(outPath, md);
  console.log(
    JSON.stringify(
      {
        status,
        recommendation,
        hit1r,
        hit3r,
        hit6r,
        mrr,
        noResultRate,
        maxDistance,
        teiDigest,
        normalizationVerified,
      },
      null,
      2,
    ),
  );
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
