'use server';

import { prisma } from './prisma';
import { isAdminAuthenticated } from './admin-auth';
import { fetchWineDetails } from './wine-details-fetch';
import type { WineDetails } from './wine-details-map';

// For forsiden: tar imot vinens id (ikke varenummer), slik at funksjonen bare
// kan brukes til å slå opp viner som faktisk er lagt inn i appen.
export async function getWineDetails(wineId: number): Promise<WineDetails | null> {
  if (!Number.isInteger(wineId)) return null;

  const wine = await prisma.wine.findUnique({ where: { id: wineId }, select: { productCode: true } });
  return wine?.productCode ? fetchWineDetails(wine.productCode) : null;
}

// For admin (handlelisten): slår opp en vilkårlig vin på varenummer
export async function getWineDetailsByCode(code: string): Promise<WineDetails | null> {
  if (!(await isAdminAuthenticated())) return null;
  return fetchWineDetails(code);
}
