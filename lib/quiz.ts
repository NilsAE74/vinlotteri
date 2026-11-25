// Ukens quiz: valg av spørsmål, tilstanden til et forsøk og topplisten.
// Vanlig servermodul (ikke 'use server'). Kallerne må selv sjekke hvem som spør;
// handlingene ligger i lib/quiz-actions.ts.

import { createHash } from 'crypto';
import { cookies } from 'next/headers';
import type { QuizAttempt } from '@prisma/client';
import { prisma } from './prisma';
import { WINE_FUN_FACTS } from './wine-fun-facts';
import { QUIZ_QUESTIONS, QUESTIONS_PER_QUIZ, SECONDS_PER_QUESTION, quizClass, type QuizQuestion } from './quiz-questions';

export const QUIZ_COOKIE = 'quiz_token';
// Litt slingringsmonn for nettverket før et svar regnes som for sent
const GRACE_MS = 2000;
export const LIMIT_MS = SECONDS_PER_QUESTION * 1000;
const TOP_COUNT = 5;

// --- Typer som også brukes av klienten (bare som typer) ---

export type QuizQuestionView = { index: number; total: number; text: string; options: string[]; secondsLeft: number };
export type QuizFeedback = { index: number; total: number; text: string; options: string[]; chosen: number; correct: number; fact: string };
export type LeaderRow = { rank: number; name: string; score: number; className: string; seconds: number; me: boolean };
export type QuizResult = { score: number; total: number; className: string; seconds: number; rank: number; participants: number; top: LeaderRow[] };
export type QuizState =
  | { kind: 'question'; question: QuizQuestionView; score: number }
  | { kind: 'between'; next: number; total: number; score: number }
  | { kind: 'done'; result: QuizResult };

// --- Spørsmål per runde ---

// Liten deterministisk tilfeldighetsgenerator (mulberry32), så samme runde
// alltid får samme spørsmål og samme rekkefølge på svarene
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

const BY_ID = new Map(QUIZ_QUESTIONS.map(q => [q.id, q]));
// Fast rekkefølge på hele banken; hver runde tar de neste fem, så det går
// mange uker før et spørsmål kommer igjen
const ROTATION = seededShuffle(QUIZ_QUESTIONS.map(q => q.id), 1855);

export function questionIdsForRound(roundId: number) {
  const start = (roundId * QUESTIONS_PER_QUIZ) % ROTATION.length;
  return Array.from({ length: QUESTIONS_PER_QUIZ }, (_, i) => ROTATION[(start + i) % ROTATION.length]);
}

// Svaralternativene i rundens rekkefølge, og hvor det riktige havnet
function arranged(q: QuizQuestion, roundId: number) {
  const order = seededShuffle([0, 1, 2, 3], hashSeed(`${roundId}:${q.id}`));
  return { options: order.map(i => q.options[i]), correct: order.indexOf(q.answer) };
}

function questionAt(attempt: QuizAttempt, index: number) {
  const q = BY_ID.get(attempt.questionIds[index]);
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
  const { q, options, correct } = questionAt(attempt, index);
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

  return { index, total: attempt.questionIds.length, text: q.text, options, chosen, correct, fact: WINE_FUN_FACTS[q.factIndex] ?? '' };
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
  const { q, options } = questionAt(a, index);
  const left = Math.max(0, LIMIT_MS - (Date.now() - a.shownAt.getTime()));
  return {
    kind: 'question',
    score: a.score,
    question: { index, total, text: q.text, options, secondsLeft: Math.ceil(left / 1000) },
  };
}

// --- Toppliste ---

function toRow(a: { name: string; score: number; timeMs: number }, rank: number, me: boolean): LeaderRow {
  return { rank, name: a.name, score: a.score, className: quizClass(a.score), seconds: Math.round(a.timeMs / 100) / 10, me };
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
  return { participants: all.length, top: all.slice(0, TOP_COUNT).map((a, i) => toRow(a, i + 1, false)) };
}

async function resultFor(attempt: QuizAttempt): Promise<QuizResult> {
  const all = await finished(attempt.roundId);
  const myIndex = all.findIndex(a => a.id === attempt.id);
  const top = all.slice(0, TOP_COUNT).map((a, i) => toRow(a, i + 1, a.id === attempt.id));
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
