// Gir samme person samme navn på tvers av kjøp.
// Vanlig servermodul (ikke server action), brukes fra bookTicket.

import type { PrismaClient } from '@prisma/client';

// Fjerner mellomrom i start/slutt og doble mellomrom inni
export function cleanName(raw: string) {
  return raw.trim().replace(/\s+/g, ' ');
}

// Finner riktig skrivemåte for et navn:
// 1. Kjent alias (initialer, fullt navn …) → navnet aliaset peker på
// 2. Samme navn som i ansattlisten, uansett store/små bokstaver → skrivemåten derfra
// 3. Ellers navnet slik det ble skrevet (uten ekstra mellomrom)
export async function canonicalName(prisma: Pick<PrismaClient, 'navneAlias' | 'ansatte'>, raw: string) {
  const name = cleanName(raw);
  const key = name.toLocaleLowerCase('nb');

  const alias = await prisma.navneAlias.findUnique({ where: { alias: key } });
  if (alias) return cleanName(alias.navn);

  const ansatte = await prisma.ansatte.findMany({ where: { Navn: { not: null } }, select: { Navn: true } });
  const match = ansatte.map(a => cleanName(a.Navn!)).find(n => n.toLocaleLowerCase('nb') === key);
  return match ?? name;
}
