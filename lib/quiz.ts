// Ukens quiz: valg av spørsmål, tilstanden til et forsøk og topplisten.
// Vanlig servermodul (ikke 'use server'). Kallerne må selv sjekke hvem som spør;
// handlingene ligger i lib/quiz-actions.ts.

import { createHash, randomInt } from 'crypto';
import { cookies } from 'next/headers';
import type { QuizAttempt } from '@prisma/client';
import { prisma } from './prisma';
import { getActiveQuestionIds, getQuestion, type QuizQuestion } from './quiz-bank';
import { QUIZ_BONUS, bonusActive } from './quiz-season';

export const QUESTIONS_PER_QUIZ = 5;
export const SECONDS_PER_QUESTION = 20; // Samme som i src/components/QuizGame.tsx

// Klassene fra Bordeaux-klassifiseringen fra 1855, etter antall riktige svar (0–5)
const CLASSES = ['Ikke klassifisert', 'Cinquième Cru', 'Quatrième Cru', 'Troisième Cru', 'Deuxième Cru', 'Premier Cru'];
export function quizClass(score: number) {
  return CLASSES[Math.max(0, Math.min(CLASSES.length - 1, score))];
}

export const QUIZ_COOKIE = 'quiz_token';
// Litt slingringsmonn for nettverket før et svar regnes som for sent
const GRACE_MS = 2000;
export const LIMIT_MS = SECONDS_PER_QUESTION * 1000;
const TOP_COUNT = 5;

// --- Typer som også brukes av klienten (bare som typer) ---

export type QuizQuestionView = { index: number; total: number; text: string; options: string[]; secondsLeft: number };
export type QuizFeedback = { index: number; total: number; text: string; options: string[]; chosen: number; correct: number; fact: string };
// bonus = bonuslodd i ukens trekning (topp 3 fra 2027)
export type LeaderRow = { rank: number; name: string; score: number; className: string; seconds: number; me: boolean; bonus?: number };
export type QuizResult = { score: number; total: number; className: string; seconds: number; rank: number; participants: number; top: LeaderRow[] };
export type QuizState =
  | { kind: 'question'; question: QuizQuestionView; score: number }
  | { kind: 'between'; next: number; total: number; score: number }
  | { kind: 'done'; result: QuizResult };

// --- Spørsmål per runde ---

// Liten deterministisk tilfeldighetsgenerator (mulberry32), så samme runde
// alltid får samme rekkefølge på svarene
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seededShuffle<T>(list: T[], seed: number) {
  const r = rng(seed);
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function hashSeed(text: string) {
  return createHash('sha256').update(text).digest().readUInt32LE(0);
}

// Trekker fem tilfeldige aktive spørsmål, og tar de som er brukt i færrest
// tidligere runder først, så det går lenge før et spørsmål kommer igjen.
// Tilfeldig (ikke utledet av runde-id), så ingen kan regne ut ukens spørsmål.
async function pickQuestions(roundId: number) {
  const active = await getActiveQuestionIds();
  if (active.length < QUESTIONS_PER_QUIZ) return null;

  const earlier = await prisma.lotteryRound.findMany({ where: { id: { not: roundId } }, select: { quizQuestionIds: true } });
  const uses = new Map<string, number>();
  for (const r of earlier) for (const id of r.quizQuestionIds) uses.set(id, (uses.get(id) ?? 0) + 1);

  return active
    .map(id => ({ id, uses: uses.get(id) ?? 0, tiebreak: randomInt(2 ** 32) }))
    .sort((a, b) => a.uses - b.uses || a.tiebreak - b.tiebreak)
    .slice(0, QUESTIONS_PER_QUIZ)
    .map(q => q.id);
}

// Rundens spørsmål. Trekkes første gang noen starter quizen og lagres på
// runden, så alle får de samme. Null hvis banken har for få aktive spørsmål.
export async function questionIdsForRound(roundId: number): Promise<string[] | null> {
  const round = await prisma.lotteryRound.findUniqueOrThrow({ where: { id: roundId }, select: { quizQuestionIds: true } });
  if (round.quizQuestionIds.length > 0) return round.quizQuestionIds;

  // Runder der noen spilte før utvalget ble lagret på runden, beholder spørsmålene de fikk
  const first = await prisma.quizAttempt.findFirst({ where: { roundId }, orderBy: { id: 'asc' }, select: { questionIds: true } });
  const chosen = first?.questionIds ?? (await pickQuestions(roundId));
  if (!chosen) return null;

  // Starter to samtidig, er det den første som lagres som gjelder
  await prisma.lotteryRound.updateMany({ where: { id: roundId, quizQuestionIds: { isEmpty: true } }, data: { quizQuestionIds: chosen } });
  const saved = await prisma.lotteryRound.findUniqueOrThrow({ where: { id: roundId }, select: { quizQuestionIds: true } });
  return saved.quizQuestionIds;
}

// Svaralternativene i rundens rekkefølge, og hvor det riktige havnet
function arranged(q: QuizQuestion, roundId: number) {
  const order = seededShuffle([0, 1, 2, 3], hashSeed(`${roundId}:${q.id}`));
  return { options: order.map(i => q.options[i]), correct: order.indexOf(q.answer) };
}

async function questionAt(attempt: QuizAttempt, index: number) {
  const q = await getQuestion(attempt.questionIds[index]);
  if (!q) throw new Error(`Ukjent quizspørsmål: ${attempt.questionIds[index]}`);
  return { q, ...arranged(q, attempt.roundId) };
}

export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

// Forsøket som hører til cookien («<forsøk-id>.<hemmelig token>»), hvis tokenet stemmer
export async function currentAttempt() {
  const raw = (await cookies()).get(QUIZ_COOKIE)?.value;
  const [idText, token] = raw?.split('.') ?? [];
  const id = Number(idText);
  if (!Number.isInteger(id) || !token) return null;
  const attempt = await prisma.quizAttempt.findUnique({ where: { id } });
  return attempt && attempt.tokenHash === tokenHash(token) ? attempt : null;
}

// --- Svar ---

// Registrerer et svar (-1 = tiden ute). Avviser svar på feil spørsmål og
// svar som kommer etter fristen (de teller som tiden ute). Oppdateringen
// krever at shownAt er uendret, så et dobbeltklikk ikke kan svare to ganger.
export async function recordAnswer(attempt: QuizAttempt, index: number, choice: number): Promise<QuizFeedback | null> {
  if (attempt.finishedAt || !attempt.shownAt || index !== attempt.answers.length) return null;
  const elapsed = Date.now() - attempt.shownAt.getTime();
  const late = elapsed > LIMIT_MS + GRACE_MS;
  const chosen = late || choice < 0 || choice > 3 ? -1 : choice;
  const { q, options, correct } = await questionAt(attempt, index);
  const isRight = chosen === correct;
  const last = index === attempt.questionIds.length - 1;

  const updated = await prisma.quizAttempt.updateMany({
    where: { id: attempt.id, shownAt: attempt.shownAt, finishedAt: null },
    data: {
      answers: { push: chosen },
      score: { increment: isRight ? 1 : 0 },
      timeMs: { increment: Math.min(elapsed, LIMIT_MS) },
      shownAt: null,
      finishedAt: last ? new Date() : null,
    },
  });
  if (updated.count !== 1) return null;

  return { index, total: attempt.questionIds.length, text: q.text, options, chosen, correct, fact: q.fact };
}

// Viser neste spørsmål og starter klokka for det
export async function showNext(attempt: QuizAttempt): Promise<QuizAttempt> {
  if (attempt.finishedAt || attempt.shownAt) return attempt;
  return prisma.quizAttempt.update({ where: { id: attempt.id }, data: { shownAt: new Date() } });
}

// --- Tilstand ---

// Tilstanden til et forsøk slik spilleren skal se den. Har et spørsmål stått
// ubesvart forbi fristen (fanen ble lukket), registreres det som tiden ute.
export async function attemptState(attempt: QuizAttempt): Promise<QuizState> {
  let a = attempt;
  if (!a.finishedAt && a.shownAt && Date.now() - a.shownAt.getTime() > LIMIT_MS + GRACE_MS) {
    await recordAnswer(a, a.answers.length, -1);
    a = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: a.id } });
  }
  const total = a.questionIds.length;
  if (a.finishedAt) return { kind: 'done', result: await resultFor(a) };
  if (!a.shownAt) return { kind: 'between', next: a.answers.length, total, score: a.score };

  const index = a.answers.length;
  const { q, options } = await questionAt(a, index);
  const left = Math.max(0, LIMIT_MS - (Date.now() - a.shownAt.getTime()));
  return {
    kind: 'question',
    score: a.score,
    question: { index, total, text: q.text, options, secondsLeft: Math.ceil(left / 1000) },
  };
}

// --- Toppliste ---

function toRow(a: { name: string; score: number; timeMs: number }, rank: number, me: boolean, bonus?: Map<string, number>): LeaderRow {
  const b = bonus?.get(a.name);
  return { rank, name: a.name, score: a.score, className: quizClass(a.score), seconds: Math.round(a.timeMs / 100) / 10, me, ...(b ? { bonus: b } : {}) };
}

// Bonuslodd per navn i runden. Er de delt ut, er det loddene som faktisk ble
// gitt; ellers det topp 3 får hvis salget stenges nå.
async function bonusByName(roundId: number, all: { name: string }[]) {
  const round = await prisma.lotteryRound.findUnique({ where: { id: roundId }, select: { name: true, quizBonusGiven: true } });
  if (!round || !bonusActive(round.name)) return undefined;
  const result = new Map<string, number>();
  if (round.quizBonusGiven) {
    const given = await prisma.ticket.groupBy({ by: ['ownerName'], where: { roundId, isBonus: true }, _count: true });
    for (const g of given) if (g.ownerName) result.set(g.ownerName, g._count);
  } else {
    all.slice(0, QUIZ_BONUS.length).forEach((a, i) => result.set(a.name, QUIZ_BONUS[i]));
  }
  return result;
}

// Ferdige forsøk i runden, best først (flest riktige, deretter raskest)
async function finished(roundId: number) {
  return prisma.quizAttempt.findMany({
    where: { roundId, finishedAt: { not: null } },
    select: { id: true, name: true, score: true, timeMs: true },
    orderBy: [{ score: 'desc' }, { timeMs: 'asc' }, { finishedAt: 'asc' }],
  });
}

export async function getTopList(roundId: number) {
  const all = await finished(roundId);
  const bonus = await bonusByName(roundId, all);
  return { participants: all.length, top: all.slice(0, TOP_COUNT).map((a, i) => toRow(a, i + 1, false, bonus)) };
}

async function resultFor(attempt: QuizAttempt): Promise<QuizResult> {
  const all = await finished(attempt.roundId);
  const bonus = await bonusByName(attempt.roundId, all);
  const myIndex = all.findIndex(a => a.id === attempt.id);
  const top = all.slice(0, TOP_COUNT).map((a, i) => toRow(a, i + 1, a.id === attempt.id, bonus));
  return {
    score: attempt.score,
    total: attempt.questionIds.length,
    className: quizClass(attempt.score),
    seconds: Math.round(attempt.timeMs / 100) / 10,
    rank: myIndex + 1,
    participants: all.length,
    top,
  };
}

// --- Bonuslodd (fra 2027) ---

// Gir topp 3 i rundens quiz 3, 2 og 1 tilfeldige ledige lodd, merket som
// bonuslodd. Kalles når salget stenges (toggleRoundLock), så quizen er
// stengt og ingen kan kjøpe de ledige loddene i mellomtiden. Skjer bare én
// gang per runde: gjenåpnes og stenges salget igjen, deles det ikke ut på nytt.
// Er det for få ledige lodd, får de øverste først. Returnerer det som ble gitt.
export async function awardQuizBonus(roundId: number): Promise<{ name: string; numbers: number[] }[]> {
  const round = await prisma.lotteryRound.findUnique({ where: { id: roundId }, select: { name: true, quizBonusGiven: true } });
  if (!round || round.quizBonusGiven || !bonusActive(round.name)) return [];
  const top = (await finished(roundId)).slice(0, QUIZ_BONUS.length);

  return prisma.$transaction(async tx => {
    // Merk runden først, så to samtidige stenginger ikke begge deler ut
    const claimed = await tx.lotteryRound.updateMany({ where: { id: roundId, quizBonusGiven: false }, data: { quizBonusGiven: true } });
    if (claimed.count !== 1) return [];

    const free = (await tx.ticket.findMany({ where: { roundId, isTaken: false }, select: { number: true } })).map(t => t.number);
    for (let i = free.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [free[i], free[j]] = [free[j], free[i]];
    }

    const given: { name: string; numbers: number[] }[] = [];
    let next = 0;
    for (const [place, a] of top.entries()) {
      const numbers = free.slice(next, next + QUIZ_BONUS[place]).sort((x, y) => x - y);
      next += numbers.length;
      if (numbers.length === 0) break;
      await tx.ticket.updateMany({
        where: { roundId, number: { in: numbers }, isTaken: false },
        data: { ownerName: a.name, isTaken: true, isBonus: true },
      });
      given.push({ name: a.name, numbers });
    }
    return given;
  });
}
