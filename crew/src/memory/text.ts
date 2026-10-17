/**
 * Deterministic text handling for the memory: normalising a lesson into tokens, and deciding
 * whether two lessons say the same thing. No model is asked; the same input always gives the
 * same answer.
 */

/** Words that carry no meaning for matching. Negations are kept on purpose (see `negated`). */
const STOPWORDS: ReadonlySet<string> = new Set([
  'a', 'an', 'the', 'and', 'or', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'is', 'are', 'was',
  'were', 'be', 'been', 'being', 'it', 'its', 'this', 'that', 'these', 'those', 'as', 'by', 'from',
  'when', 'than', 'then', 'so', 'if', 'into', 'onto', 'do', 'does', 'did', 'should', 'must',
  'can', 'could', 'will', 'would', 'always', 'they', 'them', 'their', 'there', 'which', 'who',
  'what', 'all', 'any', 'each', 'every', 'more', 'most', 'very', 'also', 'just', 'item', 'items',
  'we', 'you', 'your', 'our', 'has', 'have', 'had', 'get', 'gets', 'got', 'up',
]);

/** Words that turn a lesson into its opposite; two lessons differing in them are never merged. */
const NEGATIONS: ReadonlySet<string> = new Set(['not', 'no', 'never', 'avoid', 'without', 'dont', 'cannot', 'nor']);

/** A crude suffix stemmer: enough that `bowls`/`bowl` and `loaded`/`loading`/`load` meet. */
export function stem(word: string): string {
  let w = word;
  if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ied')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 4 && /(ches|shes|sses|xes)$/.test(w)) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith('ly')) w = w.slice(0, -2);
  return w;
}

/** The meaningful tokens of a text: lowercase, punctuation stripped, stopwords dropped, stemmed, unique, sorted. */
export function tokens(text: string): readonly string[] {
  const words = text
    .toLowerCase()
    .replace(/n't\b/g, ' not')
    .replace(/[^a-z0-9_\s]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0 && !STOPWORDS.has(w));
  return [...new Set(words.map((w) => (NEGATIONS.has(w) ? 'not' : stem(w))))].sort();
}

/** Jaccard similarity of two token lists (1 for two empty lists). */
export function jaccard(a: readonly string[], b: readonly string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const sa = new Set(a);
  let inter = 0;
  for (const t of new Set(b)) if (sa.has(t)) inter += 1;
  return inter / (sa.size + new Set(b).size - inter);
}

/** Lowercase, trimmed, unique, sorted tags; no tags at all means `general`. */
export function normaliseTags(tags: readonly string[]): readonly string[] {
  const out = [...new Set(tags.map((t) => t.trim().toLowerCase()).filter((t) => t.length > 0))].sort();
  return out.length > 0 ? out : ['general'];
}

/** Similarity at or above which two lessons with a tag in common are the same lesson. */
export const MERGE_JACCARD = 0.5;
/** Similarity at or above which two lessons are the same lesson whatever their tags. */
export const IDENTICAL_JACCARD = 0.85;

/**
 * How alike two lessons are, 0..1, or 0 when they must not be merged: the token Jaccard, when
 * it reaches `MERGE_JACCARD` and the tags overlap, or reaches `IDENTICAL_JACCARD`; and never
 * when one is negated and the other is not.
 */
export function sameLessonScore(
  a: { readonly tokens: readonly string[]; readonly tags: readonly string[] },
  b: { readonly tokens: readonly string[]; readonly tags: readonly string[] },
): number {
  if (a.tokens.includes('not') !== b.tokens.includes('not')) return 0;
  const j = jaccard(a.tokens, b.tokens);
  if (j >= IDENTICAL_JACCARD) return j;
  const tagsOverlap = a.tags.some((t) => b.tags.includes(t));
  return tagsOverlap && j >= MERGE_JACCARD ? j : 0;
}
