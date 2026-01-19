'use server';

import { cookies } from 'next/headers';
import { PrismaClient } from '@prisma/client';
import { startNewWeeklyLottery } from './actions';

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

// 2. Hent statistikk og historikk
export async function getAdminStats() {
  // Siste 3 vinnere (på tvers av runder)
  const recentWinners = await prisma.ticket.findMany({
    where: { hasWon: true },
    orderBy: { round: { createdAt: 'desc' } }, // Antar vi sorterer på rundens dato
    take: 3,
    include: { round: true }
  });

  // Statistikk: Hvilke tall vinner oftest?
  const winningNumbers = await prisma.ticket.groupBy({
    by: ['number'],
    where: { hasWon: true },
    _count: { number: true },
    orderBy: { _count: { number: 'desc' } },
    take: 5
  });

  return { recentWinners, winningNumbers };
}

// 3. Wrapper for å starte ny runde (så vi kan kalle den fra Admin UI)
export async function adminStartNewRound(formData: FormData) {
    // Generer et navn basert på dato, f.eks "Uke 4, 2026"
    const date = new Date();
    const week = Math.ceil((((date.getTime() - new Date(date.getFullYear(), 0, 1).getTime()) / 86400000) + 1) / 7);
    const name = `Uke ${week}, ${date.getFullYear()}`;

    await startNewWeeklyLottery(name);
}

export async function drawWinnerAction() {
  // 1. Finn kandidater KUN fra aktiv runde
  const candidates = await prisma.ticket.findMany({
    where: { 
      isTaken: true, 
      hasWon: false,
      round: { isActive: true } // <--- VIKTIG TILLEGG
    },
  }); 

  if (candidates.length === 0) {
    return { success: false, message: "Ingen lodd å trekke fra i den aktive runden." };
  }

  // 2. Velg en tilfeldig vinner
  const randomIndex = Math.floor(Math.random() * candidates.length);
  const winner = candidates[randomIndex];

  // 3. Marker vinneren i databasen
  await prisma.ticket.update({
    where: { id: winner.id },
    data: { hasWon: true }
  });

  // 4. Returner suksess med vinner-data
  return { 
    success: true, 
    winner: { 
      number: winner.number, 
      owner: winner.ownerName 
    } 
  };
}