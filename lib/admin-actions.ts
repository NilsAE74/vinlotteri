'use server';

import { PrismaClient} from '@prisma/client';
import { createWeeklyRound } from './lottery';
import {
  checkAdminPassword,
  setAdminSession,
  isAdminAuthenticated,
  loginBlockedMessage,
  recordFailedLogin,
  clearFailedLogins,
} from './admin-auth';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { QUIZ_COOKIE, awardQuizBonus } from './quiz';
import { formatWine, type WineSearchResult } from './wine-format';
import { fetchWineDetails } from './wine-details-fetch';
import { generateWeeklySummary } from './ai-comment';
import type { WineDetails } from './wine-details-map';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  pickCombination,
  priceWindow,
  totalBottles,
  type Candidate,
  type Category,
  type Counts,
  type Pools,
} from './wine-suggestions';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 1. Innlogging (maks 5 feilforsøk per 15 minutter per IP)
export async function verifyAdminPassword(formData: FormData) {
  const blocked = await loginBlockedMessage();
  if (blocked) return { success: false, message: blocked };

  if (checkAdminPassword(formData.get('password'))) {
    await clearFailedLogins();
    await setAdminSession(); // Cookie som varer i 24 timer
    return { success: true };
  }
  await recordFailedLogin();
  return { success: false, message: 'Feil passord' };
}

// . HENT DATA TIL ADMIN-SIDEN
// Denne funksjonen returnerer nå "eligibleTickets" (de som faktisk kan vinne)
export async function getAdminPageData() {
  if (!(await isAdmin())) return { activeRound: null, eligibleTickets: [], takenCount: 0 };

  const activeRound = await prisma.lotteryRound.findFirst({
    where: { isActive: true },
    include: { tickets: true, wines: { orderBy: { position: 'asc' } } }
  });

  if (!activeRound) return { activeRound: null, eligibleTickets: [], takenCount: 0 };

    // Finn navnene på de som allerede har vunnet i denne runden
    const winnersInRound = activeRound.tickets
    .filter((t) => t.hasWon)
    .map((t) => t.ownerName); // F.eks ["Ola Nordmann", "Kari"]

    // Filtrer loddene:
  // 1. Må ikke allerede ha vunnet
  // 2. Eieren (hvis solgt) må IKKE ha vunnet før
  const eligibleTickets = activeRound.tickets.filter((t) =>
    !t.hasWon &&
    (t.ownerName === null || !winnersInRound.includes(t.ownerName))
  );

  return { 
    activeRound, 
    eligibleTickets, // Dette er "Potten" nå
    takenCount: activeRound.tickets.filter((t) => t.isTaken && !t.isBonus).length // Totalt solgt (for statistikk); bonuslodd er ikke solgt
  };
}

// Add this type definition
type HallOfFameEntry = {
  ownerName: string;
  _count: {
    ownerName: number;
  };
};

// 3. Hent statistikk og historikk
export async function getAdminStats(): Promise<{
  hallOfFame: HallOfFameEntry[];
  winningNumbers: { number: number; _count: { number: number } }[];
}> {
  if (!(await isAdmin())) return { hallOfFame: [], winningNumbers: [] };

  // Hall of Fame: Alle vinnere gruppert etter navn med antall seiere
  const hallOfFame = await prisma.ticket.groupBy({
    by: ['ownerName'],
    where: { 
      hasWon: true,
      ownerName: { not: null } // Sikrer at vi ikke teller null-navn
    },
    _count: { ownerName: true },
    orderBy: { _count: { ownerName: 'desc' } }, // Sorter etter flest seiere først
    take: 5 // Begrens til topp 5 for å unngå for lang liste
  });

  // Statistikk: Hvilke tall vinner oftest?
  const winningNumbers = await prisma.ticket.groupBy({
    by: ['number'],
    where: { hasWon: true },
    _count: { number: true },
    orderBy: { _count: { number: 'desc' } },
    take: 5
  });

  return { hallOfFame: hallOfFame as HallOfFameEntry[], winningNumbers };
}


// 2. TREKKE-LOGIKK (MED "VINN KUN ÉN GANG" REGEL)
// onlySold: trekk kun blant solgte lodd (brukes av rutenett-visningen).
// Uten den trekkes det blant alle lodd, også usolgte (klassisk visning).
export async function drawWinnerAction(options?: { onlySold?: boolean }) {
  const onlySold = options?.onlySold === true;
  if (!(await isAdmin())) return { success: false, message: "Ikke innlogget som admin." };
  try {
    const activeRound = await prisma.lotteryRound.findFirst({
      where: { isActive: true },
      include: { tickets: true }
    });

    if (!activeRound) return { success: false, message: "Ingen aktiv runde." };

     // 1. Finn navn på de som ALLEREDE har vunnet
     const previousWinners = activeRound.tickets
     .filter((t) => t.hasWon)
     .map((t) => t.ownerName);

    // 2. Finn kandidater (alle lodd som ikke har vunnet, og hvis solgt: eier har ikke vunnet før).
    //    Med onlySold er usolgte lodd ikke med i potten.
    const candidates = activeRound.tickets.filter((t) =>
      !t.hasWon &&
      (onlySold ? t.isTaken && t.ownerName !== null : true) &&
      (t.ownerName === null || !previousWinners.includes(t.ownerName))
    );

    if (candidates.length === 0) {
      return { success: false, message: onlySold ? "Ingen flere solgte lodd med nye vinnere igjen i potten!" : "Ingen flere unike vinnere igjen i potten!" };
    }

    // 3. Trekk vinner
    const randomIndex = Math.floor(Math.random() * candidates.length);
    const winner = candidates[randomIndex];

    // 4. Oppdater databasen
    await prisma.ticket.update({
      where: { id: winner.id },
      data: { hasWon: true },
    });

    // Ingen revalidatePath her, vi gjør det fra frontend etter animasjon
    return {
      success: true,
      winner: { number: winner.number, owner: winner.ownerName }
    };

  } catch (error) {
    console.error("Draw error:", error);
    return { success: false, message: "Systemfeil under trekning." };
  }
}

// 3. Wrapper for å starte ny runde (så vi kan kalle den fra Admin UI)
export async function adminStartNewRound(formData: FormData) {
    if (!(await isAdmin())) return;

    // Id-en til runden som var aktiv da knappen ble vist (sperre mot dobbeltklikk)
    const raw = formData.get('activeRoundId');
    const expectedActiveRoundId = raw ? Number(raw) : null;

    const lastRound = await prisma.lotteryRound.findFirst({
        orderBy: { id: 'desc' }
    });

    let week: number;
    let year: number;

    const match = lastRound?.name?.match(/Uke (\d+), (\d+)/);
    if (match) {
        week = parseInt(match[1]) + 2;
        year = parseInt(match[2]);
        if (week > 52) {
            week -= 52;
            year += 1;
        }
    } else {
        const date = new Date();
        year = date.getFullYear();
        week = Math.ceil((((date.getTime() - new Date(year, 0, 1).getTime()) / 86400000) + 1) / 7);
    }

    await createWeeklyRound(`Uke ${week}, ${year}`, expectedActiveRoundId);
    revalidatePath('/');
    revalidatePath('/admin', 'layout');
}

// Legg til denne nederst i filen:

export async function toggleRoundLock() {
  if (!(await isAdmin())) return;

  const activeRound = await prisma.lotteryRound.findFirst({
    where: { isActive: true },
  });

  if (!activeRound) return;

  // Bytt status (hvis låst -> åpne, hvis åpen -> lås)
  await prisma.lotteryRound.update({
    where: { id: activeRound.id },
    data: { isLocked: !activeRound.isLocked }
  });

  // Når salget stenges, er quizen ferdig: topp 3 får bonuslodd (fra 2027, bare én gang per runde)
  if (!activeRound.isLocked) await awardQuizBonus(activeRound.id);

  revalidatePath('/');// Oppdaterer både Admin og brukernes forside
  revalidatePath('/quiz');
}

// 4. VININFO

const isAdmin = isAdminAuthenticated;

export type { WineSearchResult } from './wine-format';

// Utsnitt av feltene vi bruker fra Vinmonopolets søkesvar
type VmpProduct = {
  code: string;
  name: string;
  price?: { formattedValue?: string; value?: number };
  main_country?: { name?: string };
  district?: { name?: string };
  volume?: { formattedValue?: string };
  alcohol?: { formattedValue?: string };
  images?: { format: string; url: string }[];
  url?: string;
  product_selection?: string;
};

const VMP_HEADERS = { 'User-Agent': 'Mozilla/5.0' };

function toSearchResult(p: VmpProduct): WineSearchResult {
  return {
    code: p.code,
    name: p.name,
    price: p.price?.formattedValue ?? null,
    country: p.main_country?.name ?? null,
    district: p.district?.name ?? null,
    volume: p.volume?.formattedValue ?? null,
    alcohol: p.alcohol?.formattedValue ?? null,
    imageUrl: p.images?.find(i => i.format === 'product')?.url ?? null,
    url: p.url ? `https://www.vinmonopolet.no${p.url}` : null,
  };
}

// Søker i Vinmonopolets nettbutikk (uoffisielt API, samme som vinmonopolet.no bruker)
export async function searchVinmonopolet(query: string): Promise<WineSearchResult[]> {
  if (!(await isAdmin())) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const res = await fetch(
      `https://www.vinmonopolet.no/vmpws/v2/vmp/products/search?q=${encodeURIComponent(q)}&pageSize=10&fields=FULL`,
      { headers: VMP_HEADERS, cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data: { products?: VmpProduct[] } = await res.json();

    return (data.products ?? []).map(toSearchResult);
  } catch (error) {
    console.error('Vinmonopolet search error:', error);
    return [];
  }
}

// --- Handleliste: forslag til flasker innenfor et budsjett ---

export type VmpStore = { id: string; name: string };

// Alle Vinmonopolets butikker, sortert på navn (mellomlagres i et døgn)
export async function getVinmonopoletStores(): Promise<VmpStore[]> {
  if (!(await isAdmin())) return [];
  try {
    const res = await fetch('https://www.vinmonopolet.no/vmpws/v2/vmp/stores?pageSize=1000&fields=BASIC', {
      headers: VMP_HEADERS,
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) return [];
    const data: { stores?: { name?: string; displayName?: string }[] } = await res.json();
    return (data.stores ?? [])
      .filter((s): s is { name: string; displayName: string } => !!s.name && !!s.displayName)
      .map(s => ({ id: s.name, name: s.displayName }))
      .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
  } catch (error) {
    console.error('Vinmonopolet stores error:', error);
    return [];
  }
}

// Utvalgene vi henter fra. «AndreUtvalg» er filteret som dekker basisutvalget
// (pluss litt testutvalg, som sorteres bort under). Flere verdier i samme filter
// gir OG i søket, så hvert utvalg hentes for seg.
const SELECTION_FILTERS = { basis: 'AndreUtvalg', special: 'Spesialutvalg' };
const ALLOWED_SELECTIONS = new Set(['Basisutvalget', 'Spesialutvalg']);

// Henter opptil to sider (48 viner) for ett søk
async function fetchCandidatePages(query: string, category: Category): Promise<Candidate[]> {
  const out: Candidate[] = [];
  for (let page = 0; page < 2; page++) {
    const res = await fetch(
      `https://www.vinmonopolet.no/vmpws/v2/vmp/products/search?pageSize=24&currentPage=${page}&fields=FULL&q=${encodeURIComponent(query)}`,
      { headers: VMP_HEADERS, next: { revalidate: 60 * 15 } }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data: { products?: VmpProduct[]; pagination?: { totalPages?: number } } = await res.json();
    for (const p of data.products ?? []) {
      if (typeof p.price?.value !== 'number' || !/^\d+$/.test(p.code)) continue;
      out.push({ ...toSearchResult(p), category, priceValue: p.price.value, selection: p.product_selection ?? null });
    }
    if ((data.pagination?.totalPages ?? 0) <= page + 1) break;
  }
  return out;
}

async function fetchCandidates(
  category: Category,
  window: { min: number; max: number },
  storeId: string | null,
  includeSpecial: boolean,
): Promise<Candidate[]> {
  // Kun vanlige 75 cl glassflasker (ikke kartong, bag-in-box eller magnum)
  let base = `:relevance:mainCategory:${category}:priceValue:[${window.min} TO ${window.max}]:volumeRanges:75 - 99 cl:Emballasjetype:Glass`;
  if (storeId) base += `:availableInStores:${storeId}`;

  // Basisutvalget alltid, spesialutvalget bare hvis valgt
  const filters = includeSpecial ? [SELECTION_FILTERS.basis, SELECTION_FILTERS.special] : [SELECTION_FILTERS.basis];
  const queries = filters.map(s => `${base}:StockAvailability:${s}`);
  const results = (await Promise.all(queries.map(q => fetchCandidatePages(q, category)))).flat();

  const unique = new Map<string, Candidate>();
  for (const w of results) {
    if (w.selection && ALLOWED_SELECTIONS.has(w.selection)) unique.set(w.code, w);
  }
  return [...unique.values()];
}

export type SuggestionInput = {
  budget: number;
  counts: Counts;
  storeId: string | null;
  includeSpecial: boolean; // Ta med spesialutvalget i tillegg til basisutvalget
  minPrice: number;
};

export type SuggestionResult =
  | { success: true; wines: Candidate[]; pools: Pools; excludedCount: number }
  | { success: false; message: string };

export async function suggestWines(input: SuggestionInput): Promise<SuggestionResult> {
  if (!(await isAdmin())) return { success: false, message: 'Ikke innlogget' };

  const budget = Math.floor(Number(input.budget));
  const minPrice = Math.max(0, Math.floor(Number(input.minPrice) || 0));
  const counts: Counts = {};
  for (const c of CATEGORIES) {
    const n = Math.floor(Number(input.counts?.[c] ?? 0));
    if (n > 0) counts[c] = Math.min(n, 6);
  }
  const bottles = totalBottles(counts);
  const storeId = input.storeId && /^\d+$/.test(input.storeId) ? input.storeId : null;

  if (!Number.isFinite(budget) || budget < 100 || budget > 50000) return { success: false, message: 'Ugyldig budsjett' };
  if (bottles < 1 || bottles > 10) return { success: false, message: 'Velg mellom 1 og 10 flasker' };

  const window = priceWindow(budget, bottles, minPrice);
  if (!window) return { success: false, message: `Budsjettet holder ikke til ${bottles} flasker à minst ${minPrice} kr` };

  // Viner som er loddet ut før (eller allerede ligger i denne runden) foreslås ikke
  const used = await prisma.wine.findMany({ where: { productCode: { not: null } }, select: { productCode: true } });
  const usedCodes = new Set(used.map(w => w.productCode));

  const pools: Pools = {};
  let excludedCount = 0;
  try {
    for (const c of CATEGORIES) {
      if (!counts[c]) continue;
      const all = await fetchCandidates(c, window, storeId, !!input.includeSpecial);
      pools[c] = all.filter(w => !usedCodes.has(w.code));
      excludedCount += all.length - pools[c]!.length;
    }
  } catch (error) {
    console.error('Vinmonopolet suggestion error:', error);
    return { success: false, message: 'Fikk ikke kontakt med Vinmonopolet. Prøv igjen litt senere.' };
  }

  for (const c of CATEGORIES) {
    const need = counts[c] ?? 0;
    const have = pools[c]?.length ?? 0;
    if (need > have) {
      return {
        success: false,
        message: `Fant bare ${have} ${CATEGORY_LABELS[c].toLowerCase()} mellom ${window.min} og ${window.max} kr. Prøv uten butikkfilter, med spesialutvalget eller med lavere minstepris.`,
      };
    }
  }

  const wines = pickCombination(pools, counts, budget);
  if (!wines) return { success: false, message: 'Fant ingen kombinasjon innenfor budsjettet' };
  return { success: true, wines, pools, excludedCount };
}

function revalidateWines() {
  revalidatePath('/');
  revalidatePath('/admin');
}

// Legger til en flaske nederst i listen for den aktive runden
export async function addWine(info: string, imageUrl: string | null, productCode: string | null = null) {
  if (!(await isAdmin())) return { success: false, message: 'Ikke innlogget' };
  const text = info.trim();
  if (!text) return { success: false, message: 'Mangler tekst' };

  const activeRound = await prisma.lotteryRound.findFirst({
    where: { isActive: true },
    include: { wines: { orderBy: { position: 'desc' }, take: 1 } },
  });
  if (!activeRound) return { success: false, message: 'Ingen aktiv runde' };

  await prisma.wine.create({
    data: {
      roundId: activeRound.id,
      info: text,
      imageUrl: imageUrl || null,
      // Kun sifre: varenummeret brukes i URL mot Vinmonopolet
      productCode: productCode && /^\d+$/.test(productCode) ? productCode : null,
      position: (activeRound.wines[0]?.position ?? -1) + 1,
    },
  });
  await onWinesChanged(activeRound.id);

  revalidateWines();
  return { success: true };
}

// Når viner legges til eller fjernes: listen er igjen bare et forslag til admin
// bekrefter på nytt, og AI-oppsummeringen lages på nytt.
async function onWinesChanged(roundId: number) {
  await prisma.lotteryRound.update({ where: { id: roundId }, data: { winesConfirmed: false } });
  await refreshRoundSummary(roundId);
}

// Bekrefter (eller angrer bekreftelsen av) at ukens viner er de riktige.
// Før bekreftelse vises vinene som forslag på forsiden.
export async function setWinesConfirmed(confirmed: boolean) {
  if (!(await isAdmin())) return { success: false, message: 'Ikke innlogget' };
  const activeRound = await prisma.lotteryRound.findFirst({
    where: { isActive: true },
    include: { _count: { select: { wines: true } } },
  });
  if (!activeRound) return { success: false, message: 'Ingen aktiv runde' };
  if (confirmed && activeRound._count.wines === 0) return { success: false, message: 'Legg til viner først' };

  await prisma.lotteryRound.update({ where: { id: activeRound.id }, data: { winesConfirmed: confirmed } });
  revalidateWines();
  return { success: true };
}

// Lager AI-oppsummeringen av rundens viner på nytt. Bare viner med
// varenummer har fakta å bygge på.
// Feiler stille, og returnerer false hvis det ikke ble noen oppsummering.
async function refreshRoundSummary(roundId: number): Promise<boolean> {
  const wines = await prisma.wine.findMany({
    where: { roundId, productCode: { not: null } },
    orderBy: { position: 'asc' },
    select: { productCode: true },
  });
  if (wines.length === 0) {
    await prisma.lotteryRound.update({ where: { id: roundId }, data: { aiSummary: null } });
    return false;
  }

  const details = (await Promise.all(wines.map(w => fetchWineDetails(w.productCode!)))).filter(
    (d): d is WineDetails => d !== null
  );
  const summary = await generateWeeklySummary(details);
  if (!summary) return false;

  await prisma.lotteryRound.update({ where: { id: roundId }, data: { aiSummary: summary } });
  return true;
}

export async function regenerateRoundSummary() {
  if (!(await isAdmin())) return { success: false, message: 'Ikke innlogget' };
  const activeRound = await prisma.lotteryRound.findFirst({ where: { isActive: true } });
  if (!activeRound) return { success: false, message: 'Ingen aktiv runde' };

  const ok = await refreshRoundSummary(activeRound.id);
  revalidateWines();
  return ok
    ? { success: true }
    : { success: false, message: 'Fikk ikke laget oppsummering. Prøv igjen om litt.' };
}

// Tom tekst fjerner oppsummeringen
export async function updateRoundSummary(summary: string) {
  if (!(await isAdmin())) return { success: false, message: 'Ikke innlogget' };
  const activeRound = await prisma.lotteryRound.findFirst({ where: { isActive: true } });
  if (!activeRound) return { success: false, message: 'Ingen aktiv runde' };

  const text = summary.trim().slice(0, 2000);
  await prisma.lotteryRound.update({ where: { id: activeRound.id }, data: { aiSummary: text || null } });
  revalidateWines();
  return { success: true };
}

// Legger handlelisten til som ukens premier. Slår opp vinene på nytt ut fra
// varenummer, så klienten bare sender varenumre (ikke fritekst).
export async function addSuggestedWines(productCodes: string[]) {
  if (!(await isAdmin())) return { success: false, message: 'Ikke innlogget' };
  const codes = [...new Set(productCodes)].filter(c => /^\d+$/.test(c)).slice(0, 10);
  if (codes.length === 0) return { success: false, message: 'Ingen flasker valgt' };

  const activeRound = await prisma.lotteryRound.findFirst({
    where: { isActive: true },
    include: { wines: { orderBy: { position: 'desc' }, take: 1 } },
  });
  if (!activeRound) return { success: false, message: 'Ingen aktiv runde' };

  let wines: WineSearchResult[];
  try {
    wines = await Promise.all(
      codes.map(async code => {
        const res = await fetch(`https://www.vinmonopolet.no/vmpws/v3/vmp/products/${code}?fields=FULL`, {
          headers: VMP_HEADERS,
          cache: 'no-store',
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} for ${code}`);
        const p: VmpProduct & { content?: { traits?: { name?: string; formattedValue?: string }[] } } = await res.json();
        // I v3 ligger alkohol under content.traits i stedet for i eget felt
        const alcohol = p.alcohol ?? { formattedValue: p.content?.traits?.find(t => t.name === 'Alkohol')?.formattedValue };
        return toSearchResult({ ...p, alcohol, code });
      })
    );
  } catch (error) {
    console.error('Vinmonopolet product error:', error);
    return { success: false, message: 'Fikk ikke hentet vinene fra Vinmonopolet' };
  }

  const start = (activeRound.wines[0]?.position ?? -1) + 1;
  await prisma.wine.createMany({
    data: wines.map((w, i) => ({
      roundId: activeRound.id,
      info: formatWine(w),
      imageUrl: w.imageUrl,
      productCode: w.code,
      position: start + i,
    })),
  });
  await onWinesChanged(activeRound.id);

  revalidateWines();
  return { success: true };
}

export async function updateWine(id: number, info: string) {
  if (!(await isAdmin())) return { success: false, message: 'Ikke innlogget' };
  const text = info.trim();
  if (!text) return { success: false, message: 'Mangler tekst' };

  await prisma.wine.update({ where: { id }, data: { info: text } });
  revalidateWines();
  return { success: true };
}

export async function deleteWine(id: number) {
  if (!(await isAdmin())) return { success: false, message: 'Ikke innlogget' };

  const deleted = await prisma.wine.delete({ where: { id } });
  await onWinesChanged(deleted.roundId);
  revalidateWines();
  return { success: true };
}

// 5. FEILBOOKINGER

// Frigir lodd i den aktive runden slik at de blir ledige igjen.
// Lodd som allerede har vunnet blir ikke rørt.
export async function releaseTickets(ticketIds: number[]) {
  if (!(await isAdmin())) return { success: false, message: 'Ikke innlogget' };
  if (ticketIds.length === 0) return { success: false, message: 'Ingen lodd valgt' };

  const activeRound = await prisma.lotteryRound.findFirst({ where: { isActive: true } });
  if (!activeRound) return { success: false, message: 'Ingen aktiv runde' };

  const result = await prisma.ticket.updateMany({
    where: { id: { in: ticketIds }, roundId: activeRound.id, hasWon: false },
    data: { ownerName: null, isTaken: false, isBonus: false },
  });

  revalidatePath('/');
  revalidatePath('/admin');
  return { success: true, count: result.count };
}

// 6. NULLSTILL TREKNING
// Fjerner alle vinnere i den aktive runden. Solgte lodd og navn beholdes.
// Kun for testing: blokkeres i produksjon.
export async function resetDraw() {
  if (!(await isAdmin())) return { success: false, message: 'Ikke innlogget' };
  if (process.env.NODE_ENV === 'production') {
    return { success: false, message: 'Kun tilgjengelig i utviklingsmodus' };
  }

  const activeRound = await prisma.lotteryRound.findFirst({ where: { isActive: true } });
  if (!activeRound) return { success: false, message: 'Ingen aktiv runde' };

  const result = await prisma.ticket.updateMany({
    where: { roundId: activeRound.id, hasWon: true },
    data: { hasWon: false },
  });

  revalidatePath('/');
  revalidatePath('/admin', 'layout');
  return { success: true, count: result.count };
}

// 7. TESTDATA (kun i utviklingsmodus)
// Fiktive navn med vin-etternavn, så testlodd aldri forveksles med ekte kjøpere
// og kan ryddes bort trygt.
const TEST_FIRST_NAMES = [
  'Kari', 'Ola', 'Ingrid', 'Lars', 'Sofie', 'Henrik', 'Nora', 'Magnus', 'Emma', 'Jonas',
  'Ida', 'Sindre', 'Maja', 'Eirik', 'Thea', 'Martin', 'Sara', 'Anders', 'Hanne', 'Per',
];
const TEST_LAST_NAMES = ['Druesen', 'Korkesen', 'Tanninsen', 'Rødvinsen', 'Barriquesen', 'Mustesen', 'Karaffelsen', 'Årgangsen'];
const TEST_NAME_COUNT = 40;

async function assertDevAdmin() {
  if (!(await isAdmin())) return { success: false as const, message: 'Ikke innlogget' };
  if (process.env.NODE_ENV === 'production') {
    return { success: false as const, message: 'Kun tilgjengelig i utviklingsmodus' };
  }
  return null;
}

// Fyller opptil `count` tilfeldige LEDIGE lodd i den aktive runden med testnavn.
// Lodd som allerede er tatt blir aldri overskrevet.
export async function generateTestTickets(count = 100) {
  const denied = await assertDevAdmin();
  if (denied) return denied;

  const activeRound = await prisma.lotteryRound.findFirst({ where: { isActive: true } });
  if (!activeRound) return { success: false, message: 'Ingen aktiv runde' };

  const free = await prisma.ticket.findMany({
    where: { roundId: activeRound.id, isTaken: false },
    select: { number: true },
  });
  if (free.length === 0) return { success: false, message: 'Ingen ledige lodd igjen' };

  // Tilfeldige ledige numre
  const numbers = free.map(t => t.number);
  for (let i = numbers.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [numbers[i], numbers[j]] = [numbers[j], numbers[i]];
  }
  const chosen = numbers.slice(0, Math.min(count, numbers.length));

  // Et utvalg unike testnavn med ujevn vekting (noen kjøper mange lodd, andre få)
  const allNames = TEST_FIRST_NAMES.flatMap(f => TEST_LAST_NAMES.map(l => `${f} ${l}`));
  const names = allNames.sort(() => Math.random() - 0.5).slice(0, TEST_NAME_COUNT);
  const weights = names.map(() => Math.random() ** 2 + 0.05);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  const pickName = () => {
    let r = Math.random() * totalWeight;
    for (let i = 0; i < names.length; i++) {
      r -= weights[i];
      if (r <= 0) return names[i];
    }
    return names[names.length - 1];
  };

  const byName = new Map<string, number[]>();
  for (const n of chosen) {
    const name = pickName();
    byName.set(name, [...(byName.get(name) ?? []), n]);
  }

  // isTaken: false i where-betingelsen sikrer at ingen lodd som ble kjøpt
  // i mellomtiden blir overskrevet
  const results = await prisma.$transaction(
    [...byName.entries()].map(([ownerName, nums]) =>
      prisma.ticket.updateMany({
        where: { roundId: activeRound.id, number: { in: nums }, isTaken: false },
        data: { ownerName, isTaken: true },
      })
    )
  );
  const created = results.reduce((sum, r) => sum + r.count, 0);

  revalidatePath('/');
  revalidatePath('/admin', 'layout');
  return { success: true, count: created, names: byName.size };
}

// Fjerner alle testlodd (navn med test-etternavn) i den aktive runden
export async function removeTestTickets() {
  const denied = await assertDevAdmin();
  if (denied) return denied;

  const activeRound = await prisma.lotteryRound.findFirst({ where: { isActive: true } });
  if (!activeRound) return { success: false, message: 'Ingen aktiv runde' };

  const result = await prisma.ticket.updateMany({
    where: {
      roundId: activeRound.id,
      OR: TEST_LAST_NAMES.map(l => ({ ownerName: { endsWith: ` ${l}` } })),
    },
    data: { ownerName: null, isTaken: false, hasWon: false, isBonus: false },
  });

  revalidatePath('/');
  revalidatePath('/admin', 'layout');
  return { success: true, count: result.count };
}

// Sletter alle quizforsøk i den aktive runden, så alle kan ta quizen på nytt.
// Fjerner også quiz-cookien i denne nettleseren. Kun i utviklingsmodus.
export async function resetQuiz() {
  const denied = await assertDevAdmin();
  if (denied) return denied;

  const activeRound = await prisma.lotteryRound.findFirst({ where: { isActive: true } });
  if (!activeRound) return { success: false, message: 'Ingen aktiv runde' };

  const result = await prisma.quizAttempt.deleteMany({ where: { roundId: activeRound.id } });
  (await cookies()).delete(QUIZ_COOKIE);

  revalidatePath('/');
  revalidatePath('/quiz');
  revalidatePath('/admin', 'layout');
  return { success: true, count: result.count };
}

// 7. REGNSKAP: egne poster (positivt beløp = inn, negativt = ut)
const accountingPostSchema = z.object({
  dato: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Ugyldig dato'),
  tekst: z.string().trim().min(1, 'Skriv hva posten gjelder').max(200),
  // Norsk skrivemåte: «-1 299,50»
  belop: z
    .string()
    .transform(s => Number(s.replace(/[\s ]/g, '').replace(',', '.')))
    .refine(n => Number.isFinite(n) && n !== 0 && Math.abs(n) < 1e7, 'Ugyldig beløp'),
  roundId: z.string().transform(s => (s ? Number(s) : null)),
});

export async function addAccountingPost(formData: FormData) {
  if (!(await isAdmin())) return;
  const parsed = accountingPostSchema.safeParse({
    dato: formData.get('dato'),
    tekst: formData.get('tekst'),
    belop: formData.get('belop'),
    roundId: formData.get('roundId') ?? '',
  });
  if (!parsed.success) return; // Skjemaet har required/pattern, så dette skjer bare ved fikling
  const { dato, tekst, belop, roundId } = parsed.data;
  await prisma.regnskapspost.create({
    data: { dato: new Date(`${dato}T00:00:00Z`), tekst, belop: Math.round(belop * 100) / 100, roundId },
  });
  revalidatePath('/admin/regnskap');
}

export async function deleteAccountingPost(formData: FormData) {
  if (!(await isAdmin())) return;
  const id = Number(formData.get('id'));
  if (!Number.isInteger(id)) return;
  await prisma.regnskapspost.deleteMany({ where: { id } });
  revalidatePath('/admin/regnskap');
}
