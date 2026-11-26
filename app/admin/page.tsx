import Link from 'next/link';
import AdminLogin from '@/src/components/AdminLogin';
import ThemeToggle from '@/src/components/ThemeToggle';
import { getAdminStats, adminStartNewRound, getAdminPageData, toggleRoundLock } from '@/lib/admin-actions';
import { isAdminAuthenticated, getAdminTheme } from '@/lib/admin-auth';
import { Trophy, RefreshCw, BarChart3, Lock, Unlock, Wine, Ticket, MonitorPlay, ShoppingCart } from 'lucide-react';
import WineListEditor from '@/src/components/WineListEditor';
import WineShoppingPlanner from '@/src/components/WineShoppingPlanner';
import TicketBookingsEditor from '@/src/components/TicketBookingsEditor';
import ResetDrawButton from '@/src/components/ResetDrawButton';
import TestTicketsButtons from '@/src/components/TestTicketsButtons';
import ResetQuizButton from '@/src/components/ResetQuizButton';
import { prisma } from '@/lib/prisma';
import PendingSubmitButton from '@/src/components/PendingSubmitButton';

export default async function AdminPage() {
  if (!(await isAdminAuthenticated())) return <AdminLogin />;

  const theme = await getAdminTheme();

  // 1. Hent den nye, smarte dataen
  const { activeRound, eligibleTickets, takenCount } = await getAdminPageData();
  // Antall quizforsøk i runden (bare for nullstill-knappen i utviklingsmodus)
  const quizAttemptCount =
    process.env.NODE_ENV !== 'production' && activeRound
      ? await prisma.quizAttempt.count({ where: { roundId: activeRound.id } })
      : 0;

  // 2. Hent statistikk
  const { hallOfFame, winningNumbers } = await getAdminStats();

  return (
    <main className="min-h-screen wine-page-bg p-6 md:p-12">
      <header className="max-w-6xl mx-auto mb-12 flex justify-between items-center border-b border-[#722F37]/30 pb-6">
        <div>

          <h1 className="text-4xl font-serif text-[#D4AF37]">Lotteri Admin</h1>
          <p className="wine-text-muted">
            Aktiv runde: <span className="wine-text">{activeRound?.name || 'Ingen aktiv runde'}</span>
          </p>
        </div>
        <ThemeToggle initialTheme={theme} />
      </header>

      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* --- MAIN STAGE --- */}
        <div className="lg:col-span-2 space-y-8">
          {/* Trekning: åpnes som egen storskjermside */}
          <div className="wine-card-alpha border border-[#722F37] rounded-2xl p-8 shadow-[0_0_50px_rgba(114,47,55,0.2)] text-center">
            <h2 className="text-2xl font-serif text-[#D4AF37] mb-4">Trekning</h2>

            <div className="flex justify-center gap-8 text-sm mb-6">
              <div className="wine-text-subtle">
                Totalt solgt: <span className="wine-text font-bold">{takenCount}</span>
              </div>
              <div className="wine-text-subtle">
                Lodd igjen i potten: <span className="wine-text font-bold">{eligibleTickets.length}</span>
              </div>
            </div>

            {activeRound ? (
              <Link
                href="/admin/trekning"
                target="_blank"
                className="inline-flex items-center gap-2 px-8 py-4 bg-[#722F37] text-white font-bold text-lg uppercase tracking-widest rounded-lg shadow-xl hover:bg-[#8a3842] transition-all"
              >
                <MonitorPlay className="w-5 h-5" /> Åpne live-trekning
              </Link>
            ) : (
              <p className="wine-text-subtle">Start en ny runde for å trekke.</p>
            )}
            <p className="text-xs wine-text-subtle mt-3">Åpnes i ny fane – egnet for storskjerm/projektor.</p>
          </div>

          {/* Handleliste: forslag til hva som skal kjøpes på Vinmonopolet */}
          <div className="wine-card-bg border border-[#722F37]/50 rounded-xl p-6">
            <h3 className="text-[#D4AF37] font-serif text-xl mb-1 flex items-center gap-2">
              <ShoppingCart className="w-5 h-5" /> Handleliste
            </h3>
            <p className="text-sm wine-text-subtle mb-4">Få forslag til flasker som passer i budsjettet, med varenummer til butikken.</p>
            <WineShoppingPlanner hasActiveRound={!!activeRound} />
          </div>

          {/* Vininfo */}
          {activeRound && (
            <div className="wine-card-bg border border-[#722F37]/50 rounded-xl p-6">
              <h3 className="text-[#D4AF37] font-serif text-xl mb-4 flex items-center gap-2">
                <Wine className="w-5 h-5" /> Ukens viner
              </h3>
              <WineListEditor wines={activeRound.wines} summary={activeRound.aiSummary} confirmed={activeRound.winesConfirmed} />
            </div>
          )}

          {/* Solgte lodd / feilbookinger */}
          {activeRound && (
            <div className="wine-card-bg border border-[#722F37]/50 rounded-xl p-6">
              <h3 className="text-[#D4AF37] font-serif text-xl mb-4 flex items-center gap-2">
                <Ticket className="w-5 h-5" /> Solgte lodd
              </h3>
              <TicketBookingsEditor
                tickets={activeRound.tickets
                  .filter(t => t.isTaken)
                  .map(({ id, number, ownerName, hasWon, isBonus }) => ({ id, number, ownerName, hasWon, isBonus }))}
              />
            </div>
          )}

          {/* Handlinger */}
          <div className="wine-card-bg border border-[#333] rounded-xl p-6">
            <h3 className="text-lg wine-text-muted mb-4 flex items-center gap-2">
              <RefreshCw className="w-4 h-4" /> Administrasjon
            </h3>
            <form action={toggleRoundLock}>
               <button
                type="submit"
                className={`
                  w-full py-3 flex items-center justify-center gap-2 rounded-lg font-bold transition-all border
                  ${activeRound?.isLocked
                    ? "bg-green-900/30 border-green-800 text-green-500 hover:bg-green-900/50"
                    : "bg-red-900/30 border-red-800 text-red-500 hover:bg-red-900/50"
                  }
                `}
              >
                {activeRound?.isLocked ? (
                  <>
                    <Unlock className="w-4 h-4" /> Gjenåpne Salget
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" /> Steng Salget (Før Trekning)
                  </>
                )}
              </button>
            </form>
            {/* Kun i utviklingsmodus (npm run dev), for testing */}
            {process.env.NODE_ENV !== 'production' && activeRound && (
              <div className="my-4">
                <ResetDrawButton winnerCount={activeRound.tickets.filter(t => t.hasWon).length} />
                <div className="mt-3">
                  <TestTicketsButtons />
                </div>
                <div className="mt-3">
                  <ResetQuizButton attemptCount={quizAttemptCount} />
                </div>
              </div>
            )}
            <form action={adminStartNewRound}>
              <input type="hidden" name="activeRoundId" value={activeRound?.id ?? ''} />
              <PendingSubmitButton
                pendingText="Starter nytt lotteri…"
                className="w-full py-4 border-2 border-dashed border-[#722F37] text-[#722F37] hover:bg-[#722F37] hover:text-[#D4AF37] hover:border-transparent rounded-lg transition-all uppercase tracking-widest text-sm font-bold"
              >
                Avslutt uke & Start Nytt Lotteri
              </PendingSubmitButton>
              <p className="text-xs wine-text-subtle mt-2 text-center">
                Advarsel: Dette arkiverer nåværende runde og sletter alle lodd fra &quot;Active&quot;-visningen.
              </p>
            </form>
          </div>
        </div>

        {/* --- SIDEBAR --- */}
        <div className="space-y-6">
          <div className="wine-card-bg border border-[#722F37]/50 rounded-xl p-6">
            <h3 className="text-[#D4AF37] font-serif text-xl mb-4 flex items-center gap-2">
              <Trophy className="w-5 h-5" /> Hall of Fame
            </h3>
            <ul className="space-y-3">
              {hallOfFame.map((winner, i) => (
                <li key={i} className="flex justify-between items-center wine-border-faint border-b pb-2 last:border-0">
                  <div className="font-bold wine-text">{winner.ownerName}</div>
                  <div className="text-[#D4AF37] font-mono text-lg">{winner._count.ownerName}x</div>
                </li>
              ))}
              {hallOfFame.length === 0 && <p className="wine-text-subtle text-sm">Ingen vinnere ennå.</p>}
            </ul>
          </div>

          {/* Mest vinnende tall */}
          <div className="wine-card-bg border border-[#722F37]/50 rounded-xl p-6">
            <h3 className="text-[#D4AF37] font-serif text-xl mb-4 flex items-center gap-2">
              <BarChart3 className="w-5 h-5" /> Mestvinnende tall
            </h3>
            <ul className="space-y-3">
              {winningNumbers.map((stat, i) => (
                <li key={i} className="flex justify-between items-center wine-border-faint border-b pb-2 last:border-0">
                  <div className="font-bold wine-text">Tall {stat.number}</div>
                  <div className="text-[#D4AF37] font-mono text-lg">{stat._count.number}x</div>
                </li>
              ))}
              {winningNumbers.length === 0 && <p className="wine-text-subtle text-sm">Ingen vinnere ennå.</p>}
            </ul>
          </div>
        </div>
      </div>

    </main>
  );
}
