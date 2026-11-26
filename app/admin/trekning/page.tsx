import Link from 'next/link';
import { ArrowLeft, Lock, Unlock, Trophy, LayoutGrid, Grid3x3, CircleDot, Dices, FerrisWheel, Percent } from 'lucide-react';
import AdminLogin from '@/src/components/AdminLogin';
import WinnerReveal from '@/src/components/WinnerReveal';
import GridDrawReveal from '@/src/components/GridDrawReveal';
import SlotDrawReveal from '@/src/components/SlotDrawReveal';
import WheelDrawReveal from '@/src/components/WheelDrawReveal';
import ThemeToggle from '@/src/components/ThemeToggle';
import FullscreenButton from '@/src/components/FullscreenButton';
import WineLogo from '@/src/components/WineLogo';
import Perforation from '@/src/components/Perforation';
import RoundStamp from '@/src/components/RoundStamp';
import { getAdminPageData, toggleRoundLock } from '@/lib/admin-actions';
import { isAdminAuthenticated, getAdminTheme } from '@/lib/admin-auth';

// Trekningsvisninger, valgt med ?visning=…
const VIEWS = [
  { id: 'rutenett', label: 'Rutenett', icon: LayoutGrid }, // standard
  { id: 'alle-lodd', label: 'Alle lodd', icon: Grid3x3 },
  { id: 'automat', label: 'Spilleautomat', icon: Dices },
  { id: 'lykkehjul', label: 'Lykkehjul', icon: FerrisWheel },
  { id: 'klassisk', label: 'Klassisk', icon: CircleDot },
] as const;
type View = (typeof VIEWS)[number]['id'];

// Lenke til en visning, med eller uten vinnersjanse på brettet (?odds=vis)
function drawHref(view: View, odds: boolean) {
  const params = new URLSearchParams();
  if (view !== 'rutenett') params.set('visning', view);
  if (odds) params.set('odds', 'vis');
  const query = params.toString();
  return query ? `/admin/trekning?${query}` : '/admin/trekning';
}

// Storskjermvisning for live-trekning
export default async function DrawPage({ searchParams }: { searchParams: Promise<{ visning?: string; odds?: string }> }) {
  if (!(await isAdminAuthenticated())) return <AdminLogin />;

  const { visning: requested, odds } = await searchParams;
  const view: View = VIEWS.some(v => v.id === requested) ? (requested as View) : 'rutenett';
  // Klassisk og «Alle lodd» trekker blant alle lodd, også usolgte
  const allTickets = view === 'klassisk' || view === 'alle-lodd';
  const isGrid = view === 'rutenett' || view === 'alle-lodd';
  // Vinnersjanse under navnene på brettet – et valg, av som standard
  const showOdds = odds === 'vis';

  const theme = await getAdminTheme();
  const { activeRound, eligibleTickets, takenCount } = await getAdminPageData();

  // Dagens vinnere (usolgte lodd som ble trukket telles ikke).
  // Trekningsrekkefølgen lagres ikke, så de sorteres etter loddnummer.
  // Rutenett, spilleautomat og lykkehjul trekker kun blant solgte lodd
  const pot = allTickets ? eligibleTickets : eligibleTickets.filter(t => t.isTaken && t.ownerName);
  // «Dagens vinnere» vises ikke i rutenettene, som uthever vinnerne på brettet
  const showWinners = !isGrid;

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
                href={drawHref(id, showOdds)}
                aria-current={view === id ? 'page' : undefined}
                className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${
                  view === id ? 'wine-burgundy-bg wine-accent' : 'wine-link'
                }`}
              >
                <Icon className="w-4 h-4" /> <span className="hidden sm:inline">{label}</span>
              </Link>
            ))}
          </nav>
          {/* Vis/skjul vinnersjanse – bare i rutenettene */}
          {isGrid && (
            <Link
              href={drawHref(view, !showOdds)}
              aria-pressed={showOdds}
              title={showOdds ? 'Skjul vinnersjansen på brettet' : 'Vis vinnersjansen under navnene på brettet'}
              className={`text-sm px-3 py-1.5 rounded-lg border wine-border-faint flex items-center gap-1.5 transition-colors ${
                showOdds ? 'wine-burgundy-bg wine-accent' : 'wine-link'
              }`}
            >
              <Percent className="w-4 h-4" /> <span className="hidden sm:inline">Vinnersjanse</span>
            </Link>
          )}
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
        <div className={`flex-1 flex flex-col ${isGrid ? 'px-4 md:px-6 pt-4 md:pt-5' : 'px-6 md:px-10 pt-6'}`}>
        {/* Samme mastetopp som forsiden: ordmerke + loddbok-stempel */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <WineLogo aria-hidden className="w-8 h-8 wine-accent" />
            <h1 className="font-serif text-4xl font-semibold tracking-tight wine-text">Vinlotteri</h1>
          </div>
          <RoundStamp roundName={activeRound.name ?? ''} />
        </div>

        <Perforation />

        <div className={`flex-1 grid grid-cols-1 gap-8 ${showWinners ? 'xl:grid-cols-[1fr_28rem]' : ''} ${isGrid ? 'pb-4 md:pb-6' : 'pb-6 md:pb-10'}`}>
          {/* Trekning */}
          <section className="flex flex-col items-center justify-center text-center">
            {view === 'klassisk' ? (
              <WinnerReveal takenTickets={eligibleTickets} large />
            ) : view === 'automat' ? (
              <SlotDrawReveal pot={pot.map(t => ({ number: t.number, ownerName: t.ownerName! }))} />
            ) : view === 'lykkehjul' ? (
              <WheelDrawReveal pot={pot.map(t => ({ number: t.number, ownerName: t.ownerName! }))} />
            ) : (
              <GridDrawReveal
                key={view} // eget brett per visning, så en trekning ikke henger igjen ved bytte
                tickets={[...activeRound.tickets]
                  .sort((a, b) => a.number - b.number)
                  .map(({ number, ownerName, hasWon }) => ({ number, ownerName, hasWon }))}
                eligibleNumbers={pot.map(t => t.number)}
                onlySold={!allTickets}
                showOdds={showOdds}
              />
            )}

            {/* Samme ordlyd og stil som telleren over progress bar på forsiden */}
            <div className={`${isGrid ? 'mt-2' : 'mt-6'} flex gap-10 text-lg wine-text-muted`}>
              <span>
                <span className="wine-accent font-semibold">{takenCount}</span> lodd solgt
              </span>
              <span>
                <span className="wine-text font-semibold">{pot.length}</span> igjen i potten
              </span>
            </div>
          </section>

          {/* Dagens vinnere – ikke i rutenettet, som uthever vinnerne på brettet */}
          {showWinners && (
            <aside className="wine-card-alpha border border-dashed wine-border-strong rounded-lg p-6 self-start xl:sticky xl:top-6">
              <h2 className="text-3xl font-serif font-semibold tracking-tight wine-text mb-6 flex items-center gap-3">
                <Trophy aria-hidden className="w-7 h-7 wine-accent" /> Dagens vinnere
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
        </div>
      )}
    </main>
  );
}
