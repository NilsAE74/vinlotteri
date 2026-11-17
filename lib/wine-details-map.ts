// Oversetter et produktsvar fra Vinmonopolets API (v3, fields=FULL) til det
// vinvinduet på forsiden viser. Ren funksjon uten sideeffekter, så den kan testes.
//
// API-et er uoffisielt, så oversettingen er tolerant: felt som mangler blir utelatt.

export type WineDetails = {
  name: string | null;
  imageUrl: string | null;
  url: string;
  facts: { label: string; value: string }[]; // Korte fakta (produsent, opprinnelse, druer …)
  characteristics: { label: string; value: number; max: number }[]; // Fylde, friskhet, garvestoffer (av 12)
  notes: { label: string; value: string }[]; // Lengre tekst (farge, lukt, smak, stil)
  pairings: string[]; // Passer til
};

type Json = Record<string, unknown>;

// Gjør om et felt til lesbar tekst: streng/tall, eller objekt med vanlige tekstfelt
function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number') return String(v);
  if (typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Json;
    for (const k of ['formattedValue', 'name', 'readableValue', 'value']) {
      const t = text(o[k]);
      if (t) return t;
    }
  }
  return null;
}

const get = (o: unknown, path: string): unknown =>
  path.split('.').reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Json)[k] : undefined), o);

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

// Første felt som finnes av flere mulige plasseringer
const first = (o: unknown, ...paths: string[]) => {
  for (const p of paths) {
    const t = text(get(o, p));
    if (t) return t;
  }
  return null;
};

export function mapVinmonopoletProduct(p: Json, code: string): WineDetails {
  const content = get(p, 'content');

  const origin = [first(p, 'main_country'), first(p, 'district'), first(p, 'sub_District')].filter(Boolean).join(', ');
  const ingredients = arr(get(content, 'ingredients')).map(text).filter((t): t is string => !!t);
  // «Nebbiolo 100%» = druer; «Druer, sukker, urter» = råstoff
  const ingredientLabel = ingredients.length && ingredients.every(i => i.includes('%')) ? 'Druer' : 'Råstoff';

  // Alkohol, sukker, syre
  const traits = arr(get(content, 'traits')).map(t => ({ label: text(get(t, 'name')) ?? '', value: text(t) }));
  const hasAlcoholTrait = traits.some(t => t.label === 'Alkohol');

  const facts = [
    { label: 'Produsent', value: first(p, 'main_producer') },
    { label: 'Opprinnelse', value: origin || null },
    { label: 'Årgang', value: first(p, 'year') },
    { label: ingredientLabel, value: ingredients.join(', ') || null },
    { label: 'Type', value: first(p, 'main_sub_category', 'main_category') },
    ...(hasAlcoholTrait ? [] : [{ label: 'Alkohol', value: first(p, 'alcohol') }]),
    ...traits,
    { label: 'Volum', value: first(p, 'volume') },
    { label: 'Pris', value: first(p, 'price') },
    { label: 'Lagring', value: first(content, 'storagePotential') },
    { label: 'Allergener', value: first(p, 'allergens') },
  ].filter((f): f is { label: string; value: string } => !!f.label && !!f.value);

  // Fylde, friskhet, garvestoffer: «value» er et tall av 12
  const characteristics = arr(get(content, 'characteristics'))
    .map(c => ({ label: text(get(c, 'name')) ?? '', value: Number(get(c, 'value')), max: 12 }))
    .filter(c => c.label && Number.isFinite(c.value) && c.value > 0);

  const styleName = first(content, 'style.name');
  const styleText = first(content, 'style.description');
  const notes = [
    { label: 'Farge', value: first(p, 'color') },
    { label: 'Lukt', value: first(p, 'smell') },
    { label: 'Smak', value: first(p, 'taste') },
    { label: styleName ? `Stil: ${styleName}` : 'Stil', value: styleText ?? styleName },
    { label: 'Om vinen', value: first(p, 'summary', 'description') },
  ].filter((n): n is { label: string; value: string } => !!n.value);

  const images = arr(p.images) as Json[];
  const image = images.find(i => i.format === 'zoom') ?? images.find(i => i.format === 'superZoom') ?? images.find(i => i.format === 'product');

  const path = text(p.url);

  return {
    name: text(p.name),
    imageUrl: image ? text(image.url) : null,
    url: path?.startsWith('/') ? `https://www.vinmonopolet.no${path}` : `https://www.vinmonopolet.no/p/${code}`,
    facts,
    characteristics,
    notes,
    pairings: arr(get(content, 'isGoodFor')).map(text).filter((t): t is string => !!t),
  };
}
