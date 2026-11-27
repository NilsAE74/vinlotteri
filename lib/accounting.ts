// Regnskap for lotteriet fra og med uke 48, 2026, som en kronologisk liste.
// - Runder: inntekt = betalte lodd × loddpris (bonuslodd fra quizen er gratis),
//   vinkjøp = prisen fra Vinmonopolet i Wine.info, pluss egne poster knyttet
//   til runden. Datoen er trekningsdagen.
// - Egne poster (Regnskapspost) uten runde, f.eks. inngående saldo, står som
//   egne linjer. På samme dato kommer postene før runden.
// Vanlig servermodul (ikke 'use server'): kalleren sjekker admin-innlogging.

import { prisma } from './prisma';
import { roundWeek } from './quiz-season';
import { TICKET_PRICE } from './history';
import { drawDate } from './draw-date';

// Første runde i regnskapet
export const ACCOUNTING_FROM = { week: 48, year: 2026 };

function included(name: string | null) {
  const w = roundWeek(name);
  return !!w && (w.year > ACCOUNTING_FROM.year || (w.year === ACCOUNTING_FROM.year && w.week >= ACCOUNTING_FROM.week));
}

export type Post = { id: number; date: Date; text: string; amount: number; roundName: string | null };

type Line = { date: Date } & (
  | { kind: 'post'; post: Post }
  | {
      kind: 'round';
      id: number;
      name: string;
      paidTickets: number;
      income: number;
      bottles: number;
      cost: number;
      missingPrice: number; // Flasker uten pris i teksten (ikke med i utgiften)
      other: number; // Sum av egne poster knyttet til runden
      result: number;
    }
);
export type LedgerLine = Line & { balance: number };

// Prisen fra Vinmonopolet står sist i teksten, f.eks. «… · Kr 1 299,90»
export function parsePrice(info: string): number | null {
  const m = info.match(/kr\s*([\d\s.  ]+(?:,\d{1,2})?)\s*$/i);
  if (!m) return null;
  const n = Number(m[1].replace(/[\s.  ]/g, '').replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

const cents = (n: number) => Math.round(n * 100) / 100;

export async function getLedger(): Promise<{ lines: LedgerLine[]; posts: Post[] }> {
  const [rounds, rawPosts] = await Promise.all([
    prisma.lotteryRound.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        name: true,
        createdAt: true,
        wines: { select: { info: true } },
        _count: { select: { tickets: { where: { isTaken: true, isBonus: false } } } },
      },
    }),
    prisma.regnskapspost.findMany({
      orderBy: [{ dato: 'asc' }, { id: 'asc' }],
      include: { round: { select: { name: true } } },
    }),
  ]);

  const kept = rounds.filter(r => included(r.name));
  const keptIds = new Set(kept.map(r => r.id));
  const posts: Post[] = rawPosts.map(p => ({
    id: p.id,
    date: p.dato,
    text: p.tekst,
    amount: p.belop.toNumber(),
    roundName: p.roundId && keptIds.has(p.roundId) ? p.round?.name ?? null : null,
  }));
  const attached = new Map<number, number>();
  for (const p of rawPosts) {
    if (p.roundId && keptIds.has(p.roundId)) attached.set(p.roundId, (attached.get(p.roundId) ?? 0) + p.belop.toNumber());
  }

  type Unsorted = { sort: [number, number]; line: Line };
  const unsorted: Unsorted[] = [
    ...posts
      .filter(p => p.roundName === null)
      .map(p => ({ sort: [p.date.getTime(), 0] as [number, number], line: { kind: 'post' as const, date: p.date, post: p } })),
    ...kept.map(r => {
      const date = drawDate(r.name ?? '') ?? r.createdAt;
      const prices = r.wines.map(w => parsePrice(w.info));
      const cost = prices.reduce<number>((sum, p) => sum + (p ?? 0), 0);
      const income = r._count.tickets * TICKET_PRICE;
      const other = attached.get(r.id) ?? 0;
      return {
        sort: [date.getTime(), 1] as [number, number],
        line: {
          kind: 'round' as const,
          date,
          id: r.id,
          name: r.name ?? `Runde ${r.id}`,
          paidTickets: r._count.tickets,
          income,
          bottles: r.wines.length,
          cost,
          missingPrice: prices.filter(p => p === null).length,
          other,
          result: cents(income - cost + other),
        },
      };
    }),
  ];
  unsorted.sort((a, b) => a.sort[0] - b.sort[0] || a.sort[1] - b.sort[1]);

  let balance = 0;
  const lines = unsorted.map(({ line }) => {
    balance = cents(balance + (line.kind === 'post' ? line.post.amount : line.result));
    return { ...line, balance };
  });
  return { lines, posts };
}

// Rundene en post kan knyttes til (nyeste først)
export async function getAccountingRounds() {
  const rounds = await prisma.lotteryRound.findMany({ orderBy: { id: 'desc' }, select: { id: true, name: true } });
  return rounds.filter(r => included(r.name));
}
