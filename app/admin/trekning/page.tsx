import Link from 'next/link';
import { ArrowLeft, Lock, Unlock, Trophy } from 'lucide-react';
import AdminLogin from '@/src/components/AdminLogin';
import WinnerReveal from '@/src/components/WinnerReveal';
import ThemeToggle from '@/src/components/ThemeToggle';
import FullscreenButton from '@/src/components/FullscreenButton';
import { getAdminPageData, toggleRoundLock } from '@/lib/admin-actions';
import { isAdminAuthenticated, getAdminTheme } from '@/lib/admin-auth';

// Storskjermvisning for live-trekning
export default async function DrawPage() {
  if (!(await isAdminAuthenticated())) return <AdminLogin />;

  const theme = await getAdminTheme();
  const { activeRound, eligibleTickets, takenCount } = await getAdminPageData();

  // Dagens vinnere (usolgte lodd som ble trukket telles ikke).
  // Trekningsrekkefølgen lagres ikke, så de sorteres etter loddnummer.
  const winners = (activeRound?.tickets ?? [])
    .filter(t => t.hasWon && t.ownerName)
    .sort((a, b) => a.number - b.number);

  return (
    <main className="min-h-screen wine-page-bg flex flex-col">
      {/* Diskret toppstripe */}
      <header className="flex items-center justify-between px-6 py-3 border-b border-[#722F37]/30">
        <Link href="/admin" className="wine-text-subtle hover:text-[#D4AF37] text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Admin
        </Link>
        <div className="flex items-center gap-2">
          {activeRound && (
            <form action={toggleRoundLock}>
              <button
                type="submit"
                className={`text-sm px-3 py-1.5 rounded-lg border flex items-center gap-1.5 transition-colors ${
                  activeRound.isLocked
                    ? 'border-red-800 text-red-500 bg-red-900/20 hover:bg-red-900/40'
                    : 'border-green-800 text-green-500 bg-green-900/20 hover:bg-green-900/40'
                }`}
                title={activeRound.isLocked ? 'Klikk for å gjenåpne salget' : 'Klikk for å stenge salget'}
              >
                {activeRound.isLocked ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
                {activeRound.isLocked ? 'Salget er stengt' : 'Salget er åpent'}
              </button>
            </form>
          )}
          <ThemeToggle initialTheme={theme} />
          <FullscreenButton />
        </div>
      </header>

      {!activeRound ? (
        <div className="flex-1 flex items-center justify-center wine-text-subtle text-xl">
          Ingen aktiv runde.
        </div>
      ) : (
        <div className="flex-1 grid grid-cols-1 xl:grid-cols-[1fr_28rem] gap-8 p-6 md:p-10">
          {/* Trekning */}
          <section className="flex flex-col items-center justify-center text-center">
            <h1 className="text-5xl md:text-6xl font-serif text-[#D4AF37] mb-2">Vinlotteri</h1>
            <p className="wine-text-muted text-xl mb-10">{activeRound.name}</p>

            <WinnerReveal takenTickets={eligibleTickets} large />

            <div className="mt-6 flex gap-10 text-lg">
              <div className="wine-text-subtle">
                Solgte lodd: <span className="wine-text font-bold">{takenCount}</span>
              </div>
              <div className="wine-text-subtle">
                Igjen i potten: <span className="wine-text font-bold">{eligibleTickets.length}</span>
              </div>
            </div>
          </section>

          {/* Dagens vinnere */}
          <aside className="wine-card-alpha border border-[#722F37]/50 rounded-2xl p-6 self-start xl:sticky xl:top-6">
            <h2 className="text-3xl font-serif text-[#D4AF37] mb-6 flex items-center gap-3">
              <Trophy className="w-7 h-7" /> Dagens vinnere
            </h2>
            {winners.length === 0 ? (
              <p className="wine-text-subtle text-lg">Ingen vinnere trukket ennå.</p>
            ) : (
              <table className="w-full text-left">
                <thead>
                  <tr className="wine-text-subtle text-sm uppercase tracking-wider">
                    <th className="pb-3 w-20">Lodd</th>
                    <th className="pb-3">Vinner</th>
                  </tr>
                </thead>
                <tbody>
                  {winners.map(w => (
                    <tr key={w.id} className="wine-border-faint border-t text-xl">
                      <td className="py-3 text-[#D4AF37] font-mono font-bold">{w.number}</td>
                      <td className="py-3 wine-text font-bold">{w.ownerName}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
