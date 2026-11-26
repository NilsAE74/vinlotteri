// Spørsmålsbanken til quizen og fun-factene, hentet fra databasen
// (tabellene QuizSporsmal og FunFact, som redigeres i Supabase).
// Vanlig servermodul (ikke 'use server'): spørsmålene inneholder fasiten og
// skal aldri sendes til klienten.
//
// Holdes i minnet i fem minutter, så en endring i Supabase vises innen da.

import { prisma } from './prisma';

export type QuizQuestion = {
  id: string;
  text: string;
  options: [string, string, string, string];
  answer: number;
  active: boolean;
  fact: string;
};

type Bank = {
  // Alle spørsmål, også inaktive: påbegynte forsøk kan peke på dem
  questions: Map<string, QuizQuestion>;
  // Aktive fun facts, til boksen på forsiden
  facts: string[];
};

const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; bank: Promise<Bank> } | null = null;

async function load(): Promise<Bank> {
  const [facts, rows] = await Promise.all([
    prisma.funFact.findMany({ where: { active: true }, orderBy: { id: 'asc' }, select: { text: true } }),
    prisma.quizSporsmal.findMany({ include: { fact: { select: { text: true } } } }),
  ]);

  const questions = new Map<string, QuizQuestion>();
  for (const r of rows) {
    // Hopp over rader som er feil utfylt i tabelleditoren, i stedet for å krasje quizen
    if (r.options.length !== 4 || !Number.isInteger(r.answer) || r.answer < 0 || r.answer > 3) {
      console.warn(`Quizspørsmål «${r.id}» hoppes over: trenger fire alternativer og answer 0–3.`);
      continue;
    }
    questions.set(r.id, {
      id: r.id,
      text: r.text,
      options: r.options as QuizQuestion['options'],
      answer: r.answer,
      active: r.active,
      fact: r.fact?.text ?? '',
    });
  }
  return { questions, facts: facts.map(f => f.text) };
}

function bank(): Promise<Bank> {
  if (!cache || Date.now() - cache.at > TTL_MS) {
    const loading = load();
    cache = { at: Date.now(), bank: loading };
    // En feilet henting skal ikke bli liggende i cachen
    loading.catch(() => {
      if (cache?.bank === loading) cache = null;
    });
  }
  return cache.bank;
}

export async function getQuestion(id: string) {
  return (await bank()).questions.get(id);
}

export async function getActiveQuestionIds() {
  return [...(await bank()).questions.values()].filter(q => q.active).map(q => q.id);
}

export async function getFunFacts() {
  return (await bank()).facts;
}
