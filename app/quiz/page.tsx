import Link from 'next/link';
import type { Metadata } from 'next';
import { ArrowLeft } from 'lucide-react';
import ThemeToggle from '@/src/components/ThemeToggle';
import WineLogo from '@/src/components/WineLogo';
import QuizGame from '@/src/components/QuizGame';
import QuizTopList from '@/src/components/QuizTopList';
import QuizSeasonList from '@/src/components/QuizSeasonList';
import { getAdminTheme } from '@/lib/admin-auth';
import { prisma } from '@/lib/prisma';
import { attemptState, currentAttempt, getTopList } from '@/lib/quiz';
import { bonusActive, getSeasonStandings, listSeasons, seasonOf } from '@/lib/quiz-season';

export const metadata: Metadata = { title: 'Ukens quiz – Vinlotteri' };
export const dynamic = 'force-dynamic'; // Tilstanden avhenger av cookien og klokka

export default async function QuizPage({ searchParams }: { searchParams: Promise<{ sesong?: string }> }) {
  const theme = await getAdminTheme();
  const round = await prisma.lotteryRound.findFirst({ where: { isActive: true } });

  // Pågående eller ferdig forsøk i denne nettleseren (bare for runden som gjelder nå)
  const attempt = round ? await currentAttempt() : null;
  const initial = attempt && attempt.roundId === round?.id ? await attemptState(attempt) : null;

  // Topplisten vises under quizen før man har spilt; etter at man er ferdig står den i resultatet
  const topList = round && initial?.kind !== 'done' ? await getTopList(round.id) : null;

  // Sammenlagt (fra 2027): sesongen i ?sesong=, ellers den runden hører til, ellers den nyeste
  const requested = (await searchParams).sesong;
  const seasons = await listSeasons();
  const current = seasonOf(round?.name ?? null);
  const season =
    seasons.find(s => s.id === requested) ?? seasons.find(s => s.id === current?.id) ?? seasons[0] ?? null;
  const standings = season ? await getSeasonStandings(season.id) : [];

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
            bonus={bonusActive(round.name)}
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

        {season && (
          <section aria-labelledby="sammenlagt" className="flex flex-col gap-3">
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 id="sammenlagt" className="font-serif text-2xl font-semibold wine-text">Sammenlagt {season.label}</h2>
              {seasons.length > 1 && (
                <nav aria-label="Velg sesong" className="flex flex-wrap gap-3 text-sm">
                  {seasons.map(s => (
                    <Link
                      key={s.id}
                      href={`/quiz?sesong=${s.id}`}
                      aria-current={s.id === season.id ? 'page' : undefined}
                      className={s.id === season.id ? 'wine-accent' : 'wine-link'}
                    >
                      {s.label}
                    </Link>
                  ))}
                </nav>
              )}
            </div>
            {standings.length > 0 ? (
              <QuizSeasonList rows={standings} me={attempt?.name} />
            ) : (
              <p className="wine-text-muted">Ingen har tatt quizen denne sesongen ennå.</p>
            )}
            <p className="text-sm wine-text-subtle">
              Riktige svar til sammen i sesongen. Vårsesongen er uke 1–25 og høstsesongen uke 26–50. Ved likt antall
              riktige vinner den som har brukt kortest tid til sammen.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}
