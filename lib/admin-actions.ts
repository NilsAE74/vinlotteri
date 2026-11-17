'use server';

import { PrismaClient} from '@prisma/client';
import { createWeeklyRound } from './lottery';
import { checkAdminPassword, setAdminSession, isAdminAuthenticated } from './admin-auth';
import { revalidatePath } from 'next/cache';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 1. Enkel innlogging
export async function verifyAdminPassword(formData: FormData) {
  if (checkAdminPassword(formData.get('password'))) {
    await setAdminSession(); // Cookie som varer i 24 timer
    return { success: true };
  }
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
    .filter((t: any) => t.hasWon)
    .map((t: any) => t.ownerName); // F.eks ["Ola Nordmann", "Kari"]

    // Filtrer loddene:
  // 1. Må ikke allerede ha vunnet
  // 2. Eieren (hvis solgt) må IKKE ha vunnet før
  const eligibleTickets = activeRound.tickets.filter((t: any) =>
    !t.hasWon &&
    (t.ownerName === null || !winnersInRound.includes(t.ownerName))
  );

  return { 
    activeRound, 
    eligibleTickets, // Dette er "Potten" nå
    takenCount: activeRound.tickets.filter((t: any) => t.isTaken).length // Totalt solgt (for statistikk)
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
  winningNumbers: any[]; // You might want to type this too
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
export async function drawWinnerAction() {
  if (!(await isAdmin())) return { success: false, message: "Ikke innlogget som admin." };
  try {
    const activeRound = await prisma.lotteryRound.findFirst({
      where: { isActive: true },
      include: { tickets: true }
    });

    if (!activeRound) return { success: false, message: "Ingen aktiv runde." };

     // 1. Finn navn på de som ALLEREDE har vunnet
     const previousWinners = activeRound.tickets
     .filter((t: any) => t.hasWon)
     .map((t: any) => t.ownerName);

    // 2. Finn kandidater (alle lodd som ikke har vunnet, og hvis solgt: eier har ikke vunnet før)
    const candidates = activeRound.tickets.filter((t: any) =>
      !t.hasWon &&
      (t.ownerName === null || !previousWinners.includes(t.ownerName))
    );

    if (candidates.length === 0) {
      return { success: false, message: "Ingen flere unike vinnere igjen i potten!" };
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
