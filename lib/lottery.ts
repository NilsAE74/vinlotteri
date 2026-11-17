import { prisma } from './prisma';

// Interne hjelpefunksjoner for runder.
// NB: Denne filen er IKKE en 'use server'-fil, så funksjonene her kan ikke
// kalles direkte fra nettleseren. Kallere må selv sjekke tilgang.

// Avslutter aktive runder og oppretter en ny med 200 ferske lodd
export async function createWeeklyRound(roundName: string) {
  await prisma.lotteryRound.updateMany({
    where: { isActive: true },
    data: { isActive: false },
  });

  const newRound = await prisma.lotteryRound.create({
    data: {
      name: roundName,
      isActive: true,
      tickets: {
        create: Array.from({ length: 200 }, (_, i) => ({ number: i + 1 })),
      },
    },
  });

  return newRound;
}

export async function hasActiveRound() {
  return (await prisma.lotteryRound.count({ where: { isActive: true } })) > 0;
}
