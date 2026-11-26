// Quizsesonger og bonuslodd (fra 2027).
//
// - Bonuslodd: når salget stenges, får topp 3 i ukens quiz 3, 2 og 1 gratis
//   lodd i samme ukes trekning (se awardQuizBonus i lib/quiz.ts).
// - Sammenlagt: riktige svar summeres per sesong, og samlet svartid avgjør ved
//   likt. Vårsesongen er uke 1–25 og høstsesongen uke 26–50. Uke 51–53 (jul)
//   teller ikke sammenlagt, men bonusloddene gjelder også da.
//
// Uke og år leses fra rundenavnet «Uke N, ÅÅÅÅ», som i lib/draw-date.ts.
// Vanlig servermodul (ikke 'use server').

import { prisma } from './prisma';

export const BONUS_FROM_YEAR = 2027;
// Antall bonuslodd for 1., 2. og 3. plass
export const QUIZ_BONUS = [3, 2, 1] as const;

export type Season = { id: string; label: string };
export type SeasonRow = { rank: number; name: string; score: number; quizzes: number; seconds: number };

export function roundWeek(roundName: string | null): { week: number; year: number } | null {
  const match = roundName?.match(/Uke (\d+),\s*(\d{4})/);
  return match ? { week: Number(match[1]), year: Number(match[2]) } : null;
}

// Gir runden bonuslodd til quizvinnerne?
export function bonusActive(roundName: string | null) {
  const w = roundWeek(roundName);
  return !!w && w.year >= BONUS_FROM_YEAR;
}

// Sesongen runden teller i sammenlagt, eller null (før 2027 eller i juleukene)
export function seasonOf(roundName: string | null): Season | null {
  const w = roundWeek(roundName);
  if (!w || w.year < BONUS_FROM_YEAR || w.week > 50) return null;
  return w.week <= 25
    ? { id: `${w.year}-var`, label: `Vår ${w.year}` }
    : { id: `${w.year}-host`, label: `Høst ${w.year}` };
}

// Sammenlagtlisten for en sesong, best først. Bare ferdige forsøk teller.
export async function getSeasonStandings(seasonId: string): Promise<SeasonRow[]> {
  const rounds = await prisma.lotteryRound.findMany({ select: { id: true, name: true } });
  const roundIds = rounds.filter(r => seasonOf(r.name)?.id === seasonId).map(r => r.id);
  if (roundIds.length === 0) return [];

  const attempts = await prisma.quizAttempt.findMany({
    where: { roundId: { in: roundIds }, finishedAt: { not: null } },
    select: { name: true, score: true, timeMs: true },
  });

  const byName = new Map<string, { score: number; quizzes: number; timeMs: number }>();
  for (const a of attempts) {
    const e = byName.get(a.name) ?? { score: 0, quizzes: 0, timeMs: 0 };
    e.score += a.score;
    e.quizzes++;
    e.timeMs += a.timeMs;
    byName.set(a.name, e);
  }

  return [...byName.entries()]
    .sort(([an, a], [bn, b]) => b.score - a.score || a.timeMs - b.timeMs || an.localeCompare(bn, 'nb'))
    .map(([name, e], i) => ({ rank: i + 1, name, score: e.score, quizzes: e.quizzes, seconds: Math.round(e.timeMs / 100) / 10 }));
}

// Sesonger som har minst én runde, nyeste først
export async function listSeasons(): Promise<Season[]> {
  const rounds = await prisma.lotteryRound.findMany({ select: { name: true }, orderBy: { id: 'desc' } });
  const seen = new Map<string, Season>();
  for (const r of rounds) {
    const s = seasonOf(r.name);
    if (s && !seen.has(s.id)) seen.set(s.id, s);
  }
  // Nyeste først: år, så høst før vår
  const order = (s: Season) => Number(s.id.slice(0, 4)) * 2 + (s.id.endsWith('host') ? 1 : 0);
  return [...seen.values()].sort((a, b) => order(b) - order(a));
}
