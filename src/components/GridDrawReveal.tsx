'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { drawWinnerAction } from '@/lib/admin-actions';
import { fireConfetti, playWinSound, speakWinner } from './drawEffects';
import { eliminationOrder, eliminationTimes } from './drawOrder';

// Trekningsvisning: alle 200 lodd vises i et rutenett, og loddene i potten
// slukkes gradvis til bare vinneren lyser. Med onlySold (standard) er kun
// solgte lodd med i potten og usolgte vises dempet; uten er alle lodd med.
// Solgte lodd viser bare eierens navn, usolgte viser nummeret. Med showOdds
// står eierens sjanse for å vinne under navnet: andelen av loddene som
// fortsatt er i potten. Sjansen regnes om etter hvert som lodd slukkes.
//
// Serveren trekker vinneren FØR animasjonen starter. Animasjonen er bare
// et show som alltid ender på loddet serveren valgte.

type GridTicket = { number: number; ownerName: string | null; hasWon: boolean };
type Winner = { number: number; owner: string | null };
type Phase = 'idle' | 'waiting' | 'eliminating' | 'final' | 'revealed';

// Når så mange taperlodd gjenstår, begynner de siste loddene å pulsere i gull.
// Selve tempoet styres av eliminationTimes i drawOrder.ts.
const FINAL_COUNT = 3;

export default function GridDrawReveal({
  tickets,
  eligibleNumbers,
  onlySold = true,
  showOdds = false,
}: {
  tickets: GridTicket[];
  eligibleNumbers: number[];
  onlySold?: boolean;
  showOdds?: boolean;
}) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [eliminated, setEliminated] = useState<Set<number>>(new Set());
  const [winner, setWinner] = useState<Winner | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const eligible = useMemo(() => new Set(eligibleNumbers), [eligibleNumbers]);
  const isRunning = phase === 'waiting' || phase === 'eliminating' || phase === 'final';

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const eliminate = (n: number) =>
    setEliminated(prev => {
      const next = new Set(prev);
      next.add(n);
      return next;
    });

  const handleDraw = async () => {
    if (eligibleNumbers.length === 0) return;
    clearTimers();
    setError(null);
    setWinner(null);
    setShowCard(false);
    setEliminated(new Set());
    setPhase('waiting');

    let result: Awaited<ReturnType<typeof drawWinnerAction>>;
    try {
      result = await drawWinnerAction({ onlySold });
    } catch {
      result = { success: false, message: 'Noe gikk galt under trekningen. Prøv igjen.' };
    }
    if (!result.success || !result.winner) {
      setPhase('idle');
      setError(result.message ?? 'Trekningen feilet.');
      return;
    }

    const w = result.winner;

    // Når det er like mange lodd igjen som deltakere, er alle som ikke har vunnet med (se drawOrder.ts)
    const ownerOf = new Map(tickets.map(t => [t.number, t.ownerName?.trim() ?? null]));
    const winnerOwner = ownerOf.get(w.number) ?? w.owner?.trim() ?? null;
    const { losers } = eliminationOrder(eligibleNumbers, ownerOf, w.number, winnerOwner);

    // Tempo: pausen mellom hvert lodd øker gradvis etter hvert som det blir
    // færre lodd igjen (se eliminationTimes i drawOrder.ts)
    const times = eliminationTimes(losers.length);
    setPhase(losers.length <= FINAL_COUNT ? 'final' : 'eliminating');
    losers.forEach((n, i) => {
      if (i === losers.length - 1) return; // Siste taper slukkes samtidig med avsløringen
      later(times[i], () => {
        eliminate(n);
        // De siste loddene pulserer i gull
        if (losers.length - i - 1 === FINAL_COUNT) setPhase('final');
      });
    });

    // Det siste taperloddet slukkes i samme øyeblikk som vinneren avsløres, slik
    // at avsløringen kommer akkurat når bare vinnerloddet står igjen
    const lastLoser = losers.at(-1);
    const revealAt = times.at(-1) ?? 800;
    later(revealAt, () => {
      if (lastLoser !== undefined) eliminate(lastLoser);
      setWinner(w);
      setPhase('revealed');
      setShowCard(true);
      if (w.owner) {
        fireConfetti();
        playWinSound();
        speakWinner(w.number, w.owner);
      }
      router.refresh(); // Oppdaterer «Dagens vinnere» og potten
    });
  };

  const reset = () => {
    clearTimers();
    setPhase('idle');
    setWinner(null);
    setShowCard(false);
    setEliminated(new Set());
  };

  const remainingNumbers = eligibleNumbers.filter(n => !eliminated.has(n));
  const remaining = remainingNumbers.length;

  // Hver eiers andel av loddene som er igjen i potten
  const oddsByOwner = new Map<string, number>();
  if (showOdds && remaining > 0) {
    const ownerOf = new Map(tickets.map(t => [t.number, t.ownerName?.trim() ?? null]));
    for (const n of remainingNumbers) {
      const owner = ownerOf.get(n);
      if (owner) oddsByOwner.set(owner, (oddsByOwner.get(owner) ?? 0) + 1 / remaining);
    }
  }

  return (
    <div className="w-full flex flex-col items-center">
      {/* Samme ramme som loddboken på forsiden */}
      <div className="relative w-full grid-wrapper rounded-xl border p-1">
        {/* Rutenettet */}
        {/* På md+ er det 20 kolonner x 10 rader, og høyden tilpasses skjermen slik at
            alle 200 lodd alltid er synlige uten scrolling (25rem = toppstripe,
            mastetopp, perforering, status og knapp) */}
        <div className="grid grid-cols-10 md:grid-cols-20 md:grid-rows-10 gap-1 md:gap-1.5 w-full md:h-[max(20rem,calc(100vh-25rem))]">
          {tickets.map(t => {
            const state: CellState =
              winner?.number === t.number
                ? 'winner'
                : !eligible.has(t.number)
                  ? 'out'
                  : eliminated.has(t.number) || phase === 'revealed'
                    ? 'eliminated'
                    : phase === 'final'
                      ? 'finalist'
                      : 'pool';
            const inPool = state === 'pool' || state === 'finalist';
            const odds = inPool && t.ownerName ? oddsByOwner.get(t.ownerName.trim()) : undefined;
            return <Cell key={t.number} ticket={t} state={state} odds={odds} />;
          })}
        </div>

        {/* Vinnerkort – z-50 så det alltid ligger foran loddene (som har z-10/z-20) */}
        {showCard && winner && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="winner-card pointer-events-auto rounded-3xl px-10 py-8 md:px-16 md:py-10 text-center pop-in">
              <div className="font-mono font-bold text-7xl md:text-9xl wine-accent tracking-tighter">
                #{winner.number}
              </div>
              <div className="text-3xl md:text-5xl font-serif wine-text mt-3">
                {winner.owner ?? 'Ikke solgt – ingen vinner'}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status og knapper */}
      <div className="mt-4 h-6 text-lg wine-text-muted font-mono">
        {phase === 'waiting' && 'Trekker…'}
        {(phase === 'eliminating' || phase === 'final') && `${remaining} lodd igjen`}
      </div>

      {error && <p className="mt-2 text-red-500">{error}</p>}

      <div className="mt-2 h-16 flex items-center">
        {phase === 'revealed' ? (
          <button onClick={reset} className="wine-link transition-colors text-lg">
            Gjør klar til neste
          </button>
        ) : (
          <button
            onClick={handleDraw}
            disabled={isRunning || eligibleNumbers.length === 0}
            className="wine-cta px-10 py-4 font-bold text-xl rounded-lg shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform"
          >
            {isRunning ? 'Trekker…' : 'Trekk vinner'}
          </button>
        )}
      </div>
    </div>
  );
}

type CellState = 'pool' | 'finalist' | 'eliminated' | 'out' | 'winner';

// Kortnavn som på salgssiden: «Ola Nordmann» → «Ola N.»
function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

// Sjanse som prosent med norsk tallformat: «0,5 %», «4,2 %», «12 %»
function formatOdds(share: number) {
  const pct = share * 100;
  const digits = pct < 10 ? 1 : 0;
  return `${pct.toLocaleString('nb-NO', { minimumFractionDigits: digits, maximumFractionDigits: digits })} %`;
}

// Fargene følger salgssiden: ledige lodd = «ticket-available» med nummer,
// solgte lodd = «ticket-taken» med bare eierens navn (nummeret står i tooltip
// og på vinnerkortet).
function Cell({ ticket, state, odds }: { ticket: GridTicket; state: CellState; odds?: number }) {
  const sold = !!ticket.ownerName;
  const base = sold ? 'ticket-taken' : 'ticket-available';

  const look: Record<CellState, string> = {
    pool: base,
    finalist: `${base} ticket-finalist border-2 animate-pulse scale-110 z-10 shadow-[0_0_20px_rgba(199,154,62,0.6)]`,
    eliminated: `${base} opacity-25 scale-95`,
    // Ikke med i potten:
    // - vunnet (solgt): tydelig messing, som på salgssiden – dette er dagens vinnere
    // - trukket, men usolgt: dempet og gjennomstreket
    // - eieren har allerede vunnet: dempet
    out: ticket.hasWon && sold
      ? 'ticket-result shadow-[0_0_15px_rgba(199,154,62,0.4)] z-10'
      : `${base} opacity-25 ${ticket.hasWon ? 'line-through' : ''}`,
    winner: 'ticket-result scale-125 z-20 shadow-[0_0_40px_rgba(199,154,62,0.9)]',
  };

  const gold = state === 'winner' || (state === 'out' && ticket.hasWon && sold);

  return (
    <div
      className={`min-h-10 md:min-h-0 flex flex-col items-center justify-center rounded border overflow-hidden transition-all duration-500 ${look[state]}`}
      title={`${ticket.number}: ${ticket.ownerName ?? 'Ikke solgt'}${
        odds !== undefined ? ` (${formatOdds(odds)} sjanse)` : ''
      }`}
    >
      {sold ? (
        <>
          <span
            className={`leading-tight truncate w-full px-0.5 text-center font-medium text-[10px] sm:text-xs lg:text-[13px] 2xl:text-base ${
              gold ? '' : 'wine-text'
            }`}
          >
            {shortName(ticket.ownerName!)}
          </span>
          {odds !== undefined && (
            <span className="leading-none mt-0.5 tabular-nums wine-text-muted text-[9px] sm:text-[10px] lg:text-[11px] 2xl:text-sm">
              {formatOdds(odds)}
            </span>
          )}
        </>
      ) : (
        <span className={`font-mono font-bold leading-none text-sm lg:text-base 2xl:text-xl ${gold ? '' : 'wine-text-muted'}`}>
          {ticket.number}
        </span>
      )}
    </div>
  );
}
