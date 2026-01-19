'use server';

import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// --- VALIDERING ---
const bookTicketSchema = z.object({
  numbers: z.string().transform((str) => JSON.parse(str) as number[]), 
  name: z.string().min(2, "Navn må ha minst 2 bokstaver").max(50),
});

// --- KJØP LODD ---
export async function bookTicket(formData: FormData) {
  // 1. Validér input
  const parsed = bookTicketSchema.safeParse({
    numbers: formData.get('numbers'),
    name: formData.get('name'),
  });

  if (!parsed.success) {
    return { success: false, message: "Ugyldig data." };
  }

  const { numbers, name } = parsed.data;

  try {
    // 2. FINN AKTIV RUNDE (Dette manglet!)
    const activeRound = await prisma.lotteryRound.findFirst({
      where: { isActive: true },
    });

    if (!activeRound) {
      return { success: false, message: "Ingen aktiv lotteri-runde funnet." };
    }

    // 3. Oppdater kun lodd i den aktive runden
    const result = await prisma.ticket.updateMany({
      where: {
        number: { in: numbers }, // Sjekk tallene
        isTaken: false,          // Må være ledig
        roundId: activeRound.id  // VIKTIG: Må tilhøre nåværende runde!
      },
      data: {
        ownerName: name,
        isTaken: true,
      },
    });

    // Sjekk om vi fikk booket alle (result.count skal være lik antall forespurte tall)
    if (result.count !== numbers.length) {
      return { success: false, message: "Noen av loddene var allerede tatt (eller finnes ikke)." };
    }

    revalidatePath('/');
    return { success: true, message: `${result.count} lodd registrert på ${name}!` };

  } catch (error) {
    console.error("Booking error:", error);
    return { success: false, message: "Databasefeil ved booking." };
  }
}

// --- ADMIN / HJELPEFUNKSJONER ---

export async function resetLottery() {
  // OBS: Denne bør kanskje oppdateres til å bare nulle ut aktive runde, 
  // men med det nye systemet bruker vi heller startNewWeeklyLottery.
  // Lar den stå for kompatibilitet hvis du bruker den manuelt.
  const activeRound = await prisma.lotteryRound.findFirst({ where: { isActive: true } });
  if (activeRound) {
    await prisma.ticket.updateMany({
      where: { roundId: activeRound.id },
      data: { isTaken: false, ownerName: null, hasWon: false },
    });
    revalidatePath('/');
  }
}

export async function startNewWeeklyLottery(roundName: string) {
  // 1. Deaktiver alle gamle runder
  await prisma.lotteryRound.updateMany({
    where: { isActive: true },
    data: { isActive: false }
  });

  // 2. Opprett ny runde med 200 ferske lodd
  const newRound = await prisma.lotteryRound.create({
    data: {
      name: roundName,
      isActive: true,
      tickets: {
        create: Array.from({ length: 200 }, (_, i) => ({
          number: i + 1,
        }))
      }
    }
  });

  revalidatePath('/');
  return { success: true, roundId: newRound.id };
}

// Merk: drawWinnerAction ligger nå sannsynligvis i lib/admin-actions.ts 
// siden vi flyttet den til admin-panelet. Hvis du bruker den herfra også,
// må du huske å inkludere roundId sjekken der også!