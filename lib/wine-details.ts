'use server';

import { prisma } from './prisma';
import { mapVinmonopoletProduct, type WineDetails } from './wine-details-map';

// Henter utfyllende vininfo fra Vinmonopolet for en vin i ukens premier.
//
// Tar imot vinens id (ikke varenummer), slik at funksjonen bare kan brukes
// til å slå opp viner som faktisk er lagt inn i appen. Svaret mellomlagres
// i et døgn.

export async function getWineDetails(wineId: number): Promise<WineDetails | null> {
  if (!Number.isInteger(wineId)) return null;

  const wine = await prisma.wine.findUnique({ where: { id: wineId }, select: { productCode: true } });
  const code = wine?.productCode;
  if (!code || !/^\d+$/.test(code)) return null;

  try {
    // NB: produktdetaljer finnes bare i v3 (v2 gir 404)
    const res = await fetch(`https://www.vinmonopolet.no/vmpws/v3/vmp/products/${code}?fields=FULL`, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      next: { revalidate: 60 * 60 * 24 },
    });
    if (!res.ok) {
      console.error(`Vinmonopolet product ${code}: HTTP ${res.status}`);
      return null;
    }
    return mapVinmonopoletProduct(await res.json(), code);
  } catch (error) {
    console.error('Vinmonopolet product error:', error);
    return null;
  }
}
