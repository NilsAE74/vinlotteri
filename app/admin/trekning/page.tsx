import Link from 'next/link';
import { ArrowLeft, Lock, Unlock, Trophy, LayoutGrid, CircleDot, Dices, FerrisWheel } from 'lucide-react';
import AdminLogin from '@/src/components/AdminLogin';
import WinnerReveal from '@/src/components/WinnerReveal';
import GridDrawReveal from '@/src/components/GridDrawReveal';
import SlotDrawReveal from '@/src/components/SlotDrawReveal';
import WheelDrawReveal from '@/src/components/WheelDrawReveal';
import ThemeToggle from '@/src/components/ThemeToggle';
import FullscreenButton from '@/src/components/FullscreenButton';
import { getAdminPageData, toggleRoundLock } from '@/lib/admin-actions';
import { isAdminAuthenticated, getAdminTheme } from '@/lib/admin-auth';

// Trekningsvisninger, valgt med ?visning=…
const VIEWS = [
  { id: 'rutenett', label: 'Rutenett', icon: LayoutGrid }, // standard
  { id: 'automat', label: 'Spilleautomat', icon: Dices },
  { id: 'lykkehjul', label: 'Lykkehjul', icon: FerrisWheel },
  { id: 'klassisk', label: 'Klassisk', icon: CircleDot },
] as const;
type View = (typeof VIEWS)[number]['id'];

// Storskjermvisning for live-trekning
export default async function DrawPage({ searchParams }: { searchParams: Promise<{ visning?: string }> }) {
  if (!(await isAdminAuthenticated())) return <AdminLogin />;

  const requested = (await searchParams).visning;
  const view: View = VIEWS.some(v => v.id === requested) ? (requested as View) : 'rutenett';
  const classic = view === 'klassisk';

  const theme = await getAdminTheme();
  const { activeRound, eligibleTickets, takenCount } = await getAdminPageData();

  // Dagens vinnere (usolgte lodd som ble trukket telles ikke).
  // Trekningsrekkefølgen lagres ikke, så de sorteres etter loddnummer.
  // Rutenett, spilleautomat og lykkehjul trekker kun blant solgte lodd, klassisk visning blant alle
  const pot = classic ? eligibleTickets : eligibleTickets.filter(t => t.isTaken && t.ownerName);
  // «Dagens vinnere» vises ikke i rutenettet, som uthever vinnerne på brettet
  const showWinners = view !== 'rutenett';

  const winners = (activeRound?.tickets ?? [])
    .filter(t => t.hasWon && t.ownerName)
    .sort((a, b) => a.number - b.number);

  return (
    <main className="min-h-screen wine-page-bg flex flex-col">
      {/* Diskret toppstripe */}
      <header className="flex items-center justify-between px-6 py-3 border-b wine-border-faint">
        <Link href="/admin" className="wine-link text-sm flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Admin
        </Link>
        <div className="flex items-center gap-2">
          {/* Velg trekningsvisning */}
          <nav className="flex rounded-lg border wine-border-faint overflow-hidden text-sm" aria-label="Trekningsvisning">
            {VIEWS.map(({ id, label, icon: Icon }) => (
              <Link
                key={id}
                href={id === 'rutenett' ? '/admin/trekning' : `/admin/trekning?visning=${id}`}
                aria-current={view === id ? 'page' : undefined}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  view === id ? 'wine-burgundy-bg wine-accent' : 'wine-link'
                }`}
              >
                <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
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
        <div className={`flex-1 grid grid-cols-1 gap-8 ${showWinners ? 'xl:grid-cols-[1fr_28rem]' : ''} ${view === 'rutenett' ? 'p-4 md:p-6' : 'p-6 md:p-10'}`}>
          {/* Trekning */}
          <section className="flex flex-col items-center justify-center text-center">
            {view === 'klassisk' || view === 'automat' ? (
              <>
                <h1 className="text-5xl md:text-6xl font-serif wine-accent mb-2">Vinlotteri</h1>
                <p className="wine-text-muted text-xl mb-10">{activeRound.name}</p>
              </>
            ) : (
              // Kompakt overskrift, så rutenettet/hjulet får mest mulig plass
              <h1 className="text-3xl md:text-4xl font-serif wine-accent mb-4">
                Vinlotteri <span className="wine-text-muted text-xl md:text-2xl">· {activeRound.name}</span>
              </h1>
            )}

            {view === 'klassisk' ? (
              <WinnerReveal takenTickets={eligibleTickets} large />
            ) : view === 'automat' ? (
              <SlotDrawReveal pot={pot.map(t => ({ number: t.number, ownerName: t.ownerName! }))} />
            ) : view === 'lykkehjul' ? (
              <WheelDrawReveal pot={pot.map(t => ({ number: t.number, ownerName: t.ownerName! }))} />
            ) : (
              <GridDrawReveal
                tickets={[...activeRound.tickets]
                  .sort((a, b) => a.number - b.number)
                  .map(({ number, ownerName, hasWon }) => ({ number, ownerName, hasWon }))}
                eligibleNumbers={pot.map(t => t.number)}
              />
            )}

            <div className={`${view === 'rutenett' ? 'mt-2' : 'mt-6'} flex gap-10 text-lg`}>
              <div className="wine-text-subtle">
                Solgte lodd: <span className="wine-text font-bold">{takenCount}</span>
              </div>
              <div className="wine-text-subtle">
                Igjen i potten: <span className="wine-text font-bold">{pot.length}</span>
              </div>
            </div>
          </section>

          {/* Dagens vinnere – ikke i rutenettet, som uthever vinnerne på brettet */}
          {showWinners && (
            <aside className="wine-card-alpha border wine-border-faint rounded-2xl p-6 self-start xl:sticky xl:top-6">
              <h2 className="text-3xl font-serif wine-accent mb-6 flex items-center gap-3">
                <Trophy className="w-7 h-7" /> Dagens vinnere
              </h2>
              {winners.length === 0 ? (
                <p className="wine-text-subtle text-lg">Ingen vinnere trukket ennå.</p>
              ) : (
                <table className="w-full text-left">
                  <thead>
                    <tr className="wine-text-subtle text-sm">
                      <th className="pb-3 w-20">Lodd</th>
                      <th className="pb-3">Vinner</th>
                    </tr>
                  </thead>
                  <tbody>
                    {winners.map(w => (
                      <tr key={w.id} className="wine-border-faint border-t text-xl">
                        <td className="py-3 wine-accent font-mono font-bold">{w.number}</td>
                        <td className="py-3 wine-text font-bold">{w.ownerName}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </aside>
          )}
        </div>
      )}
    </main>
  );
}
