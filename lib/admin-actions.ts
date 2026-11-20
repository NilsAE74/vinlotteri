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
    takenCount: activeRound.tickets.filter((t) => t.isTaken).length // Totalt solgt (for statistikk)
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

  revalidatePath('/');// Oppdaterer både Admin og brukernes forside
}

// 4. VININFO

const isAdmin = isAdminAuthenticated;

export type WineSearchResult = {
  code: string;
  name: string;
  price: string | null;
  country: string | null;
  district: string | null;
  volume: string | null;
  alcohol: string | null;
  imageUrl: string | null;
  url: string | null;
};

// Utsnitt av feltene vi bruker fra Vinmonopolets søkesvar
type VmpProduct = {
  code: string;
  name: string;
  price?: { formattedValue?: string };
  main_country?: { name?: string };
  district?: { name?: string };
  volume?: { formattedValue?: string };
  alcohol?: { formattedValue?: string };
  images?: { format: string; url: string }[];
  url?: string;
};

// Søker i Vinmonopolets nettbutikk (uoffisielt API, samme som vinmonopolet.no bruker)
export async function searchVinmonopolet(query: string): Promise<WineSearchResult[]> {
  if (!(await isAdmin())) return [];
  const q = query.trim();
  if (q.length < 2) return [];

  try {
    const res = await fetch(
      `https://www.vinmonopolet.no/vmpws/v2/vmp/products/search?q=${encodeURIComponent(q)}&pageSize=10&fields=FULL`,
      { headers: { 'User-Agent': 'Mozilla/5.0' }, cache: 'no-store' }
    );
    if (!res.ok) return [];
    const data: { products?: VmpProduct[] } = await res.json();

    return (data.products ?? []).map(p => ({
      code: p.code,
      name: p.name,
      price: p.price?.formattedValue ?? null,
      country: p.main_country?.name ?? null,
      district: p.district?.name ?? null,
      volume: p.volume?.formattedValue ?? null,
      alcohol: p.alcohol?.formattedValue ?? null,
      imageUrl: p.images?.find(i => i.format === 'product')?.url ?? null,
      url: p.url ? `https://www.vinmonopolet.no${p.url}` : null,
    }));
  } catch (error) {
    console.error('Vinmonopolet search error:', error);
    return [];
  }
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

  await prisma.wine.delete({ where: { id } });
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
    data: { ownerName: null, isTaken: false },
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
    data: { ownerName: null, isTaken: false, hasWon: false },
  });

  revalidatePath('/');
  revalidatePath('/admin', 'layout');
  return { success: true, count: result.count };
}
