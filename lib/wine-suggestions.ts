// Forslagsmotor for handlelisten: velger flasker som passer i budsjettet.
// Ren logikk uten nettverk eller database, så den kan brukes både på server og klient.

import type { WineSearchResult } from './wine-format';

export const CATEGORIES = ['rødvin', 'hvitvin', 'musserende_vin', 'rosévin'] as const;
export type Category = (typeof CATEGORIES)[number];

export const CATEGORY_LABELS: Record<Category, string> = {
  rødvin: 'Rødvin',
  hvitvin: 'Hvitvin',
  musserende_vin: 'Musserende',
  rosévin: 'Rosévin',
};

export type Candidate = WineSearchResult & {
  category: Category;
  priceValue: number;
  selection: string | null; // F.eks. "Basisutvalget"
};

export type Counts = Partial<Record<Category, number>>;
export type Pools = Partial<Record<Category, Candidate[]>>;

export function totalBottles(counts: Counts) {
  return CATEGORIES.reduce((sum, c) => sum + (counts[c] ?? 0), 0);
}

export function totalPrice(wines: Candidate[]) {
  return wines.reduce((sum, w) => sum + w.priceValue, 0);
}

// Prisvindu per flaske: rundt et jevnt snitt, slik at vi ikke ender med én dyr
// og resten billige. Returnerer null hvis budsjettet ikke holder til minsteprisen.
export function priceWindow(budget: number, bottles: number, minPrice: number) {
  if (bottles < 1) return null;
  const avg = budget / bottles;
  const min = Math.max(minPrice, Math.floor(avg * 0.75));
  const max = Math.floor(Math.min(avg * 1.25, budget - (bottles - 1) * minPrice));
  return max >= min ? { min, max } : null;
}

// Høyere er bedre: bruk mest mulig av budsjettet, med jevne priser
function score(wines: Candidate[], budget: number) {
  const prices = wines.map(w => w.priceValue);
  const avg = totalPrice(wines) / wines.length;
  const spread = (Math.max(...prices) - Math.min(...prices)) / avg;
  return totalPrice(wines) / budget - 0.15 * spread;
}

function pickDistinct<T>(items: T[], n: number, random: () => number): T[] | null {
  if (items.length < n) return null;
  const copy = [...items];
  for (let i = 0; i < n; i++) {
    const j = i + Math.floor(random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, n);
}

// Velger en kombinasjon innenfor budsjettet. Prøver tilfeldige kombinasjoner og
// velger blant de beste, slik at «Nytt forslag» gir variasjon.
// Returnerer flaskene i kategorirekkefølge (rødvin først), eller null.
export function pickCombination(
  pools: Pools,
  counts: Counts,
  budget: number,
  random: () => number = Math.random,
  attempts = 4000,
): Candidate[] | null {
  const valid: { wines: Candidate[]; score: number }[] = [];
  const seen = new Set<string>();

  for (let a = 0; a < attempts; a++) {
    const wines: Candidate[] = [];
    for (const c of CATEGORIES) {
      const n = counts[c] ?? 0;
      if (n === 0) continue;
      const picked = pickDistinct(pools[c] ?? [], n, random);
      if (!picked) return null; // For få kandidater i en kategori
      wines.push(...picked.sort((x, y) => y.priceValue - x.priceValue));
    }
    if (wines.length === 0 || totalPrice(wines) > budget) continue;

    const key = wines.map(w => w.code).sort().join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    valid.push({ wines, score: score(wines, budget) });
  }

  if (valid.length === 0) return null;
  valid.sort((x, y) => y.score - x.score);
  const top = valid.slice(0, 5);
  return top[Math.floor(random() * top.length)].wines;
}

// Bytter ut én flaske med en annen i samme kategori som fortsatt holder budsjettet.
// Foretrekker flasker med lignende pris. Returnerer null hvis ingen passer.
export function swapWine(
  wines: Candidate[],
  index: number,
  pools: Pools,
  budget: number,
  random: () => number = Math.random,
): Candidate[] | null {
  const current = wines[index];
  if (!current) return null;
  const room = budget - (totalPrice(wines) - current.priceValue);
  const chosen = new Set(wines.map(w => w.code));

  const alternatives = (pools[current.category] ?? [])
    .filter(w => !chosen.has(w.code) && w.priceValue <= room)
    .sort((x, y) => Math.abs(x.priceValue - current.priceValue) - Math.abs(y.priceValue - current.priceValue))
    .slice(0, 8);
  if (alternatives.length === 0) return null;

  const next = [...wines];
  next[index] = alternatives[Math.floor(random() * alternatives.length)];
  return next;
}
