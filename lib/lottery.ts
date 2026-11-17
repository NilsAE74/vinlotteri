import { prisma } from './prisma';

// Interne hjelpefunksjoner for runder.
// NB: Denne filen er IKKE en 'use server'-fil, så funksjonene her kan ikke
// kalles direkte fra nettleseren. Kallere må selv sjekke tilgang.

// Fast nøkkel for Postgres advisory lock, slik at bare én runde kan opprettes om gangen
const NEW_ROUND_LOCK = 72_200_001;

/**
 * Avslutter den aktive runden og oppretter en ny med 200 ferske lodd.
 *
 * Sperre mot dobbeltklikk: `expectedActiveRoundId` er id-en til runden som var
 * aktiv da knappen ble vist (`null` = ingen aktiv runde). Hvis en annen runde er
 * aktiv når forespørselen kommer frem, har noen allerede startet en ny runde, og
 * ingenting gjøres. Kontrollen skjer under en databaselås, så to samtidige klikk
 * kan ikke begge slippe gjennom.
 *
 * Returnerer den nye runden, eller `null` hvis forespørselen ble avvist.
 */
export async function createWeeklyRound(roundName: string, expectedActiveRoundId: number | null) {
  return prisma.$transaction(
    async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${NEW_ROUND_LOCK})`;

      const active = await tx.lotteryRound.findFirst({
        where: { isActive: true },
        orderBy: { id: 'desc' },
        select: { id: true },
      });
      if ((active?.id ?? null) !== expectedActiveRoundId) return null;

      await tx.lotteryRound.updateMany({ where: { isActive: true }, data: { isActive: false } });

      const newRound = await tx.lotteryRound.create({ data: { name: roundName, isActive: true } });
      await tx.ticket.createMany({
        data: Array.from({ length: 200 }, (_, i) => ({ number: i + 1, roundId: newRound.id })),
      });

      return newRound;
    },
    { timeout: 20_000 }
  );
}
