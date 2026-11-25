import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/src/components/ThemeToggle';
import WineLogo from '@/src/components/WineLogo';
import QuizGame from '@/src/components/QuizGame';
import QuizTopList from '@/src/components/QuizTopList';
import { getAdminTheme } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { attemptState, currentAttempt, getTopList } from '@/lib/quiz';

export const metadata: Metadata = { title: 'Ukens quiz – Vinlotteri' };
export const dynamic = 'force-dynamic'; // Tilstanden avhenger av cookien og klokka

export default async function QuizPage() {
  const theme = await getAdminTheme();
  const round = await prisma.lotteryRound.findFirst({ where: { isActive: true } });

  // Pågående eller ferdig forsøk i denne nettleseren (bare for runden som gjelder nå)
  const attempt = round ? await currentAttempt() : null;
  const initial = attempt && attempt.roundId === round?.id ? await attemptState(attempt) : null;

  // Topplisten vises under quizen før man har spilt; etter at man er ferdig står den i resultatet
  const topList = round && initial?.kind !== 'done' ? await getTopList(round.id) : null;

  const ansatte = await prisma.ansatte.findMany({ where: { Navn: { not: null } }, select: { Navn: true } });
  const names = [...new Set(ansatte.map(a => a.Navn!.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'nb'));

  return (
    <main className="min-h-screen wine-page-bg px-4 py-8 md:py-14">
      <div className="max-w-2xl mx-auto flex flex-col gap-10">
        <div className="flex items-center justify-between">
          <Link href="/" className="wine-link text-sm flex items-center gap-1">
            <ArrowLeft className="w-4 h-4" /> Til lotteriet
          </Link>
          <ThemeToggle initialTheme={theme} />
        </div>

        <div className="flex items-center gap-3 justify-center">
          <WineLogo aria-hidden className="w-7 h-7 wine-accent" />
          <h1 className="font-serif text-3xl font-semibold tracking-tight wine-text">Ukens quiz</h1>
        </div>

        {!round ? (
          <p className="text-center wine-text-muted">Det er ingen aktiv runde nå. Quizen åpner når neste runde starter.</p>
        ) : (
          <QuizGame
            roundName={round.name ?? 'denne uka'}
            initial={initial}
            closed={round.isLocked}
            nameSuggestions={names}
          />
        )}

        {topList && topList.participants > 0 && (
          <section aria-labelledby="topp" className="flex flex-col gap-3">
            <h2 id="topp" className="font-serif text-2xl font-semibold wine-text">Ukens beste så langt</h2>
            <QuizTopList rows={topList.top} />
            <p className="text-sm wine-text-subtle">
              {topList.participants} har tatt quizen denne uka. Ved lik poengsum vinner den som svarte raskest.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
