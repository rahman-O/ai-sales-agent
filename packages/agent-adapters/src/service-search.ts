/**
 * Deterministic bilingual service search and resolution.
 * Normalizes Arabic/English customer queries and matches them against
 * tenant catalog services using deterministic aliases and token overlap.
 */

export interface ServiceRow {
  id: string;
  name: string;
  booking_enabled?: boolean;
  duration_minutes?: number;
  amount_minor?: string | number | bigint | null;
  currency?: string | null;
}

/**
 * Common bilingual dental taxonomy aliases for matching English catalog names
 * against Arabic/English queries.
 */
const CANONICAL_ALIASES_BY_NAME_PATTERN: Array<{
  pattern: RegExp;
  aliases: string[];
}> = [
  {
    pattern: /check-?up|examination|exam/i,
    aliases: [
      'dental check up',
      'dental checkup',
      'check up',
      'checkup',
      'examination',
      'exam',
      'فحص',
      'فحص اسنان',
      'فحص الاسنان',
      'كشف',
      'كشفيه',
      'كشفية',
      'معاينة',
      'معاينه',
    ],
  },
  {
    pattern: /cleaning|hygiene|scaling/i,
    aliases: [
      'teeth cleaning',
      'tooth cleaning',
      'cleaning',
      'hygiene',
      'scaling',
      'تنظيف',
      'تنظيف اسنان',
      'تنظيف الاسنان',
      'تلميع',
      'تلميع اسنان',
    ],
  },
  {
    pattern: /consultation|consult/i,
    aliases: [
      'dental consultation',
      'consultation',
      'consult',
      'doctor',
      'استشارة',
      'استشاره',
      'استشارة اسنان',
      'استشاره اسنان',
      'استشارة طبيب',
      'طبيب',
    ],
  },
  {
    pattern: /whitening|bleach/i,
    aliases: [
      'teeth whitening',
      'tooth whitening',
      'whitening',
      'bleaching',
      'تبييض',
      'تبييض اسنان',
      'تبييض الاسنان',
    ],
  },
  {
    pattern: /extraction|removal/i,
    aliases: [
      'tooth extraction',
      'extraction',
      'pull tooth',
      'قلع',
      'قلع اسنان',
      'خلع',
      'خلع اسنان',
    ],
  },
  {
    pattern: /filling|restoration/i,
    aliases: [
      'dental filling',
      'filling',
      'حشوة',
      'حشوه',
      'حشو',
      'حشوات',
    ],
  },
  {
    pattern: /implant/i,
    aliases: [
      'dental implant',
      'implant',
      'زراعة',
      'زراعه',
      'زراعة اسنان',
      'زراعه اسنان',
    ],
  },
  {
    pattern: /orthodontic|braces/i,
    aliases: [
      'braces',
      'orthodontics',
      'تقويم',
      'تقويم اسنان',
      'تقويم الاسنان',
    ],
  },
];

/**
 * Normalizes text for deterministic Arabic and English search.
 * - Trims and lowercases
 * - Removes Arabic diacritics (tashkeel) and tatweel
 * - Normalizes Arabic letter variants: [أإآٱ] -> ا, ى -> ي, ة -> ه
 * - Collapses whitespace and strips punctuation
 */
export function normalizeSearchText(text: string): string {
  if (!text) return '';
  let s = text.trim().toLowerCase();

  // Remove Arabic diacritics (harakat / tashkeel: \u064B to \u065F, \u0670) and tatweel (\u0640)
  s = s.replace(/[\u064B-\u065F\u0670\u0640]/g, '');

  // Normalize common Arabic letter variants
  s = s.replace(/[أإآٱ]/g, 'ا');
  s = s.replace(/ى/g, 'ي');
  s = s.replace(/ة/g, 'ه');

  // Strip non-alphanumeric (keep Arabic letters \u0621-\u064A and latin a-z 0-9)
  s = s.replace(/[^\u0621-\u064Aa-z0-9\s]/g, ' ');

  // Collapse whitespace
  s = s.replace(/\s+/g, ' ').trim();

  return s;
}

const GENERIC_STOP_WORDS = new Set([
  'dental',
  'teeth',
  'tooth',
  'service',
  'services',
  'اسنان',
  'الاسنان',
  'سن',
  'خدمة',
  'خدمات',
]);

/**
 * Match ranking algorithm for candidate services against normalized query.
 * Returns sorted subset of matching services.
 */
export function matchServices(
  services: ServiceRow[],
  rawQuery: string,
  limit: number = 10,
): ServiceRow[] {
  const normQ = normalizeSearchText(rawQuery);
  if (!normQ) {
    return services.slice(0, limit);
  }

  const queryTokens = normQ.split(' ').filter(Boolean);
  const coreQueryTokens = queryTokens.filter((t) => !GENERIC_STOP_WORDS.has(t));
  const tokensToMatch = coreQueryTokens.length > 0 ? coreQueryTokens : queryTokens;

  const scored: Array<{ service: ServiceRow; score: number }> = [];

  for (const svc of services) {
    const normName = normalizeSearchText(svc.name);
    let bestScore = 0;

    // 1. Exact normalized name match
    if (normName === normQ) {
      bestScore = Math.max(bestScore, 100);
    }

    // 2. Name contains full query or query contains name
    if (normName.includes(normQ)) {
      bestScore = Math.max(bestScore, 80);
    } else if (normQ.includes(normName)) {
      bestScore = Math.max(bestScore, 75);
    }

    // 3. Check canonical aliases
    for (const mapping of CANONICAL_ALIASES_BY_NAME_PATTERN) {
      if (mapping.pattern.test(svc.name)) {
        for (const alias of mapping.aliases) {
          const normAlias = normalizeSearchText(alias);
          if (normAlias === normQ) {
            bestScore = Math.max(bestScore, 90);
          } else if (normAlias.includes(normQ) || normQ.includes(normAlias)) {
            bestScore = Math.max(bestScore, 70);
          } else {
            // Token overlap with alias
            const aliasTokens = normAlias.split(' ').filter(Boolean);
            const commonTokens = tokensToMatch.filter((t) => aliasTokens.includes(t));
            if (commonTokens.length > 0) {
              const tokenScore = 50 + (commonTokens.length / tokensToMatch.length) * 15;
              bestScore = Math.max(bestScore, tokenScore);
            }
          }
        }
      }
    }

    // 4. Token overlap with service name
    const nameTokens = normName.split(' ').filter(Boolean);
    const nameCommonTokens = tokensToMatch.filter((t) => nameTokens.includes(t));
    if (nameCommonTokens.length > 0) {
      const nameTokenScore = 40 + (nameCommonTokens.length / tokensToMatch.length) * 15;
      bestScore = Math.max(bestScore, nameTokenScore);
    }

    if (bestScore > 0) {
      scored.push({ service: svc, score: bestScore });
    }
  }

  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map((s) => s.service);
}
