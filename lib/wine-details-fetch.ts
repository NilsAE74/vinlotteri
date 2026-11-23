// Henter utfyllende vininfo fra Vinmonopolet. Vanlig servermodul (ikke server
// action), så den kan brukes fra flere server actions uten å bli et eget endepunkt.

import { mapVinmonopoletProduct, type WineDetails } from './wine-details-map';

// Svaret mellomlagres i et døgn
export async function fetchWineDetails(code: string): Promise<WineDetails | null> {
  if (!/^\d+$/.test(code)) return null;
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
