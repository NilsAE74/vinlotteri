'use server';

import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
import { revalidatePath } from 'next/cache';

const globalForPrisma = global as unknown as { prisma: PrismaClient };
const prisma = globalForPrisma.prisma || new PrismaClient();
if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

// --- VALIDERING ---
const TICKETS_PER_ROUND = 200;
// Øvre grense per kjøp, så én forespørsel ikke kan reservere hele runden
const MAX_TICKETS_PER_PURCHASE = 50;

const bookTicketSchema = z.object({
  numbers: z
    .array(z.number().int().min(1).max(TICKETS_PER_ROUND))
    .min(1, "Velg minst ett lodd.")
    .max(MAX_TICKETS_PER_PURCHASE, `Du kan kjøpe maks ${MAX_TICKETS_PER_PURCHASE} lodd om gangen.`)
    .refine(nums => new Set(nums).size === nums.length, "Samme lodd er valgt flere ganger."),
  name: z.string().trim().min(2, "Navn må ha minst 2 bokstaver").max(50),
});

// Feil som skal vises til brukeren og samtidig rulle tilbake transaksjonen
class BookingError extends Error {}

function parseJson(value: FormDataEntryValue | null): unknown {
  if (typeof value !== 'string' || value.length > 2000) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

// --- KJØP LODD ---
// Alt-eller-ingenting: enten reserveres alle valgte lodd, eller ingen.
export async function bookTicket(formData: FormData) {
  // 1. Validér input
  const parsed = bookTicketSchema.safeParse({
    numbers: parseJson(formData.get('numbers')),
    name: formData.get('name'),
  });

  if (!parsed.success) {
    return { success: false, message: parsed.error.issues[0]?.message ?? "Ugyldig data." };
  }

  const { numbers, name } = parsed.data;

  try {
    const count = await prisma.$transaction(async tx => {
      // 2. Finn aktiv runde
      const activeRound = await tx.lotteryRound.findFirst({ where: { isActive: true } });
      if (!activeRound) throw new BookingError("Ingen aktiv lotteri-runde funnet.");
      if (activeRound.isLocked) throw new BookingError("Beklager, salget er stengt for denne runden!");

      // 3. Reserver loddene. isTaken: false i where-betingelsen gjør at to
      //    samtidige kjøp aldri kan få samme lodd.
      const result = await tx.ticket.updateMany({
        where: { number: { in: numbers }, isTaken: false, roundId: activeRound.id },
        data: { ownerName: name, isTaken: true },
      });

      // Var noen av loddene tatt, rulles hele kjøpet tilbake
      if (result.count !== numbers.length) {
        throw new BookingError("Noen av loddene ble nettopp tatt av noen andre. Velg på nytt.");
      }
      return result.count;
    });

    revalidatePath('/');
    return { success: true, message: `${count} lodd registrert på ${name}!` };

  } catch (error) {
    if (error instanceof BookingError) {
      revalidatePath('/'); // vis oppdatert rutenett
      return { success: false, message: error.message };
    }
    console.error("Booking error:", error);
    return { success: false, message: "Databasefeil ved booking." };
  }
}
