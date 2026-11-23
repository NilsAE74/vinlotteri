// Felles formatering av vin fra Vinmonopolet. Ren modul uten sideeffekter,
// så den kan brukes både i klientkomponenter og server actions.

export type WineSearchResult = {
  code: string;
  name: string;
  price: string | null;
  country: string | null;
  district: string | null;
  volume: string | null;
  alcohol: string | null;
  imageUrl: string | null;
  url: string | null;
};

// Lager en lesbar tekst av et søketreff, f.eks. "Barolo 2019 – Italia, Piemonte – 75 cl · 14% · Kr 699,90"
export function formatWine(w: WineSearchResult) {
  const origin = [w.country, w.district].filter(Boolean).join(', ');
  const details = [w.volume, w.alcohol, w.price].filter(Boolean).join(' · ');
  return [w.name, origin, details].filter(Boolean).join(' – ');
}
