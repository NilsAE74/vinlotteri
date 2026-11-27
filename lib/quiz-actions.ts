'use server';

// Handlinger for ukens quiz (offentlige endepunkter).
// Hvem som spiller, avgjøres av cookien: «<forsøk-id>.<hemmelig token>».

import { randomBytes } from 'crypto';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import { prisma } from './prisma';
import { canonicalName } from './names';
import { QUIZ_COOKIE, attemptState, currentAttempt, questionIdsForRound, recordAnswer, showNext, tokenHash, type QuizFeedback, type QuizState } from './quiz';

type ActionResult = { ok: true; state: QuizState; feedback?: QuizFeedback } | { ok: false; message: string };

const nameSchema = z.string().trim().min(2, 'Skriv navnet du kjøpte lodd med.').max(50);

export async function startQuiz(rawName: string): Promise<ActionResult> {
  const parsed = nameSchema.safeParse(rawName);
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message ?? 'Ugyldig navn.' };

  const round = await prisma.lotteryRound.findFirst({ where: { isActive: true } });
  if (!round) return { ok: false, message: 'Det er ingen aktiv runde nå.' };

  const name = await canonicalName(prisma, parsed.data);

  // Har denne nettleseren allerede et forsøk med samme navn, fortsetter vi der
  const mine = await currentAttempt();
  if (mine && mine.roundId === round.id && mine.name === name) {
    return { ok: true, state: await attemptState(await showNext(mine)) };
  }

  const existing = await prisma.quizAttempt.findUnique({ where: { roundId_name: { roundId: round.id, name } } });
  if (existing) return { ok: false, message: `${name} har allerede tatt quizen denne uka. Det er bare ett forsøk per person.` };

  if (round.isLocked) return { ok: false, message: 'Quizen er stengt fordi salget er stengt. Ny quiz kommer med neste runde.' };

  const tickets = await prisma.ticket.count({ where: { roundId: round.id, ownerName: name, isTaken: true } });
  if (tickets === 0) return { ok: false, message: `Fant ingen lodd på ${name} denne uka. Kjøp et lodd først, med samme navn.` };

  const questionIds = await questionIdsForRound(round.id);
  if (!questionIds) return { ok: false, message: 'Quizen er ikke klar ennå. Prøv igjen senere.' };

  const token = randomBytes(24).toString('base64url');
  let attempt;
  try {
    attempt = await prisma.quizAttempt.create({
      data: {
        roundId: round.id,
        name,
        tokenHash: tokenHash(token),
        questionIds,
        answers: [],
        shownAt: new Date(),
      },
    });
  } catch {
    // To samtidige starter med samme navn: den unike nøkkelen stopper den ene
    return { ok: false, message: `${name} har allerede startet quizen denne uka.` };
  }

  (await cookies()).set(QUIZ_COOKIE, `${attempt.id}.${token}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 14,
  });

  return { ok: true, state: await attemptState(attempt) };
}

export async function answerQuestion(index: number, choice: number): Promise<ActionResult> {
  if (!Number.isInteger(index) || !Number.isInteger(choice)) return { ok: false, message: 'Ugyldig svar.' };
  const attempt = await currentAttempt();
  if (!attempt) return { ok: false, message: 'Fant ikke quizen din. Last inn siden på nytt.' };

  const feedback = await recordAnswer(attempt, index, choice);
  const fresh = await prisma.quizAttempt.findUniqueOrThrow({ where: { id: attempt.id } });
  const state = await attemptState(fresh);
  if (state.kind === 'done') {
    revalidatePath('/'); // Topplisten på forsiden
    revalidatePath('/quiz');
  }
  // feedback er null hvis svaret allerede var registrert (dobbeltklikk, ny fane)
  return feedback ? { ok: true, state, feedback } : { ok: true, state };
}

export async function nextQuestion(): Promise<ActionResult> {
  const attempt = await currentAttempt();
  if (!attempt) return { ok: false, message: 'Fant ikke quizen din. Last inn siden på nytt.' };
  return { ok: true, state: await attemptState(await showNext(attempt)) };
}
