'use server';

import { cookies } from 'next/headers';
import { PrismaClient} from '@prisma/client';
import { startNewWeeklyLottery } from './actions';
import { revalidatePath } from 'next/cache';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// 1. Enkel innlogging
export async function verifyAdminPassword(formData: FormData) {
    const password = formData.get('password');
    
    if (password === process.env.ADMIN_PASSWORD) {
      // Sett en cookie som varer i 24 timer
      (await cookies()).set('admin_auth', 'true', { 
        httpOnly: true, 
        secure: process.env.NODE_ENV === 'production',
        maxAge: 60 * 60 * 24 
      });
      return { success: true };
    }
    return { success: false, message: 'Feil passord' };
  }

// . HENT DATA TIL ADMIN-SIDEN
// Denne funksjonen returnerer nå "eligibleTickets" (de som faktisk kan vinne)
export async function getAdminPageData() {
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

    await startNewWeeklyLottery(`Uke ${week}, ${year}`);
}

// Legg til denne nederst i filen:

export async function toggleRoundLock() {
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

async function isAdmin() {
  return (await cookies()).get('admin_auth')?.value === 'true';
}

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
export async function addWine(info: string, imageUrl: string | null) {
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
