import { prisma } from './prisma';

// Data til den offentlige vinnerhistorikk-siden.
// NB: Ikke en 'use server'-fil – kalles kun fra server-komponenter.

export type LeaderboardEntry = { rank: number; name: string; wins: number; numbers: number[] };
export type NumberStat = { number: number; withWinner: number; withoutWinner: number; total: number };
export type RoundLog = { id: number; name: string; date: Date; winners: { number: number; name: string }[] };

export async function getWinnerHistory() {
  const drawn = await prisma.ticket.findMany({
      where: { hasWon: true },
      select: {
        number: true,
        ownerName: true,
        round: { select: { id: true, name: true, createdAt: true } },
      },
    });

  // Trim navn, slik at f.eks. "Kirsti" og "Kirsti " regnes som samme person
  const withWinner = drawn
    .map(t => ({ ...t, ownerName: t.ownerName?.trim() || null }))
    .filter(t => t.ownerName);
  const unsoldDraws = drawn.length - withWinner.length;

  // Toppliste (delt plass ved likt antall: 1, 1, 3, …)
  const byName = new Map<string, number[]>();
  for (const t of withWinner) {
    byName.set(t.ownerName!, [...(byName.get(t.ownerName!) ?? []), t.number]);
  }
  const sorted = [...byName.entries()]
    .map(([name, numbers]) => ({ name, wins: numbers.length, numbers: numbers.sort((a, b) => a - b) }))
    .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name, 'nb'));
  const leaderboard: LeaderboardEntry[] = sorted.map((e, i) => ({
    ...e,
    rank: i > 0 && sorted[i - 1].wins === e.wins ? -1 : i + 1,
  }));
  for (let i = 1; i < leaderboard.length; i++) {
    if (leaderboard[i].rank === -1) leaderboard[i].rank = leaderboard[i - 1].rank;
  }

  // Mest trukne tall (med og uten gevinst)
  const byNumber = new Map<number, NumberStat>();
  for (const t of drawn) {
    const s = byNumber.get(t.number) ?? { number: t.number, withWinner: 0, withoutWinner: 0, total: 0 };
    if (t.ownerName?.trim()) s.withWinner++;
    else s.withoutWinner++;
    s.total++;
    byNumber.set(t.number, s);
  }
  const numberStats = [...byNumber.values()].sort(
    (a, b) => b.total - a.total || b.withWinner - a.withWinner || a.number - b.number
  );
  const repeatedNumbers = numberStats.filter(s => s.total >= 2).length;

  // Trekningslogg per runde, nyeste først
  const byRound = new Map<number, RoundLog>();
  for (const t of withWinner) {
    const r = byRound.get(t.round.id) ?? {
      id: t.round.id,
      name: t.round.name ?? `Runde ${t.round.id}`,
      date: t.round.createdAt,
      winners: [],
    };
    r.winners.push({ number: t.number, name: t.ownerName! });
    byRound.set(t.round.id, r);
  }
  const rounds = [...byRound.values()]
    .sort((a, b) => b.date.getTime() - a.date.getTime() || b.id - a.id)
    .map(r => ({ ...r, winners: r.winners.sort((a, b) => a.number - b.number) }));

  return {
    stats: {
      draws: withWinner.length,
      winnerCount: byName.size,
      topWins: sorted[0]?.wins ?? 0,
      topNames: sorted.filter(e => e.wins === sorted[0]?.wins).map(e => e.name),
      // Runder med minst én vinner = gjennomførte lotterier. Tomme test-/duplikatrunder
      // og runden som pågår (før trekning) telles ikke.
      roundsWithWinner: rounds.length,
      unsoldDraws,
    },
    leaderboard,
    numberStats,
    repeatedNumbers,
    rounds,
  };
}

// --- Flaksometer ---
// Hvem vinner oftere enn antall lodd skulle tilsi?
//
// For hver runde med trekning: forventede gevinster = sannsynligheten for at
// personen vant, gitt hvor mange lodd hen og alle andre hadde og hvor mange
// gevinster som gikk til solgte lodd (se winChances). Flaks = faktiske
// gevinster ÷ summen av forventede. 1 = som forventet, over 1 = flaks,
// under 1 = uflaks. Runder uten trekning (f.eks. den som pågår) telles ikke.

export type LuckEntry = {
  name: string;
  rounds: number; // Runder med trekning personen har vært med i
  tickets: number;
  wins: number;
  expected: number;
  luck: number; // Faktiske ÷ forventede gevinster
};

export const LUCK_MIN_ROUNDS = 3;

// Eksakt sannsynlighet for å vinne i en runde, per loddantall.
//
// Slik trekningen virker (drawWinnerAction): hver gevinst trekkes tilfeldig
// blant loddene som er igjen, og når noen vinner, går resten av loddene
// deres ut av potten, så ingen kan vinne to ganger. Gevinster til usolgte
// lodd fjerner ingen og påvirker ikke fordelingen blant de solgte, så det
// holder å se på de `wins` gevinstene som gikk til solgte lodd.
//
// Personer med like mange lodd har samme sjanse, så tilstanden er hvor mange
// i hver gruppe (likt loddantall) som har vunnet, pluss om «meg» har vunnet.
// Det gir få tilstander selv med mange deltakere.
//
// Svaret er en Map fra loddantall til sannsynligheten for at en person med
// så mange lodd vinner én gang i runden (0–1, aldri mer enn én gevinst).
export function winChances(ticketCounts: number[], wins: number): Map<number, number> {
  const sizes = new Map<number, number>();
  for (const c of ticketCounts) sizes.set(c, (sizes.get(c) ?? 0) + 1);
  const total = ticketCounts.reduce((a, b) => a + b, 0);

  const result = new Map<number, number>();
  for (const mine of sizes.keys()) {
    // Grupper av de andre: [loddantall, antall personer]
    const groups = [...sizes].map(([c, n]) => [c, c === mine ? n - 1 : n] as const);

    // Tilstand: vinnere per gruppe + om meg har vunnet (siste tall), som nøkkel
    let states = new Map<string, { won: number[]; me: boolean; p: number }>([
      ['', { won: groups.map(() => 0), me: false, p: 1 }],
    ]);
    for (let draw = 0; draw < wins; draw++) {
      const next = new Map<string, { won: number[]; me: boolean; p: number }>();
      const add = (won: number[], me: boolean, p: number) => {
        const key = `${won.join(',')}|${me ? 1 : 0}`;
        const s = next.get(key);
        if (s) s.p += p;
        else next.set(key, { won, me, p });
      };
      for (const { won, me, p } of states.values()) {
        const left = total - (me ? mine : 0) - groups.reduce((sum, [c], g) => sum + c * won[g], 0);
        if (left <= 0) {
          add(won, me, p); // Alle har vunnet, ingen flere å trekke blant
          continue;
        }
        if (!me) add(won, true, (p * mine) / left);
        groups.forEach(([c, n], g) => {
          if (won[g] < n) add(won.map((w, i) => (i === g ? w + 1 : w)), me, (p * (n - won[g]) * c) / left);
        });
      }
      states = next;
    }
    let pMe = 0;
    for (const s of states.values()) if (s.me) pMe += s.p;
    result.set(mine, pMe);
  }
  return result;
}

export async function getLuckStats(): Promise<LuckEntry[]> {
  const sold = await prisma.ticket.findMany({
    where: { isTaken: true, ownerName: { not: null } },
    select: { roundId: true, ownerName: true, hasWon: true },
  });

  type RoundData = { wins: number; people: Map<string, { tickets: number; wins: number }> };
  const byRound = new Map<number, RoundData>();
  for (const t of sold) {
    const name = t.ownerName!.trim();
    if (!name) continue;
    const r = byRound.get(t.roundId) ?? { wins: 0, people: new Map() };
    const p = r.people.get(name) ?? { tickets: 0, wins: 0 };
    p.tickets++;
    if (t.hasWon) {
      r.wins++;
      p.wins++;
    }
    r.people.set(name, p);
    byRound.set(t.roundId, r);
  }

  const byName = new Map<string, Omit<LuckEntry, 'name' | 'luck'>>();
  for (const r of byRound.values()) {
    if (r.wins === 0) continue; // Ingen trekning ennå
    const chance = winChances([...r.people.values()].map(p => p.tickets), r.wins);
    for (const [name, p] of r.people) {
      const e = byName.get(name) ?? { rounds: 0, tickets: 0, wins: 0, expected: 0 };
      e.rounds++;
      e.tickets += p.tickets;
      e.wins += p.wins;
      e.expected += chance.get(p.tickets)!;
      byName.set(name, e);
    }
  }

  return [...byName.entries()]
    .filter(([, e]) => e.rounds >= LUCK_MIN_ROUNDS && e.expected > 0)
    .map(([name, e]) => ({ name, ...e, luck: e.wins / e.expected }))
    .sort((a, b) => b.luck - a.luck || b.wins - a.wins || a.name.localeCompare(b.name, 'nb'));
}
