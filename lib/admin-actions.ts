'use server';

import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { startNewWeeklyLottery } from './actions';
import { revalidatePath } from 'next/cache';

const prisma = new PrismaClient();

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
    include: { tickets: true }
  });

  if (!activeRound) return { activeRound: null, eligibleTickets: [], takenCount: 0 };

  // Finn navnene på de som allerede har vunnet i denne runden
  const winnersInRound = activeRound.tickets
    .filter(t => t.hasWon)
    .map(t => t.ownerName); // F.eks ["Ola Nordmann", "Kari"]

  // Filtrer loddene:
  // 1. Må være tatt
  // 2. Eieren må IKKE ha vunnet før
  const eligibleTickets = activeRound.tickets.filter(t => 
    t.isTaken && 
    t.ownerName && 
    !winnersInRound.includes(t.ownerName)
  );

  return { 
    activeRound, 
    eligibleTickets, // Dette er "Potten" nå
    takenCount: activeRound.tickets.filter(t => t.isTaken).length // Totalt solgt (for statistikk)
  };
}

// 3. Hent statistikk og historikk
export async function getAdminStats() {
  // Hall of Fame: Alle vinnere gruppert etter navn med antall seiere
  const hallOfFame = await prisma.ticket.groupBy({
    by: ['ownerName'],
    where: { 
      hasWon: true,
      ownerName: { not: null } // Sikrer at vi ikke teller null-navn
    },
    _count: { ownerName: true },
    orderBy: { _count: { ownerName: 'desc' } }, // Sorter etter flest seiere først
    take: 10 // Begrens til topp 10 for å unngå for lang liste
  });

  // Statistikk: Hvilke tall vinner oftest?
  const winningNumbers = await prisma.ticket.groupBy({
    by: ['number'],
    where: { hasWon: true },
    _count: { number: true },
    orderBy: { _count: { number: 'desc' } },
    take: 5
  });

  return { hallOfFame, winningNumbers };
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
      .filter(t => t.hasWon)
      .map(t => t.ownerName);

    // 2. Finn kandidater (Lodd som er tatt, men eier har ikke vunnet før)
    const candidates = activeRound.tickets.filter(t => 
      t.isTaken && 
      t.ownerName && 
      !previousWinners.includes(t.ownerName)
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
    // Generer et navn basert på dato, f.eks "Uke 4, 2026"
    const date = new Date();
    const week = Math.ceil((((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7);
    const name = `Uke ${week}, ${date.getFullYear()}`;

    await startNewWeeklyLottery(name);
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