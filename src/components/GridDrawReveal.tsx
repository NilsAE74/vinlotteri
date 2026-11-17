'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { drawWinnerAction } from '@/lib/admin-actions';
import { fireConfetti, playWinSound, speakWinner } from './drawEffects';

// Trekningsvisning: alle 200 lodd vises i et rutenett, og loddene i potten
// slukkes gradvis til bare vinneren lyser. Kun solgte lodd er med i potten;
// usolgte vises dempet.
//
// Serveren trekker vinneren FØR animasjonen starter. Animasjonen er bare
// et show som alltid ender på loddet serveren valgte.

type GridTicket = { number: number; ownerName: string | null; hasWon: boolean };
type Winner = { number: number; owner: string | null };
type Phase = 'idle' | 'waiting' | 'eliminating' | 'final' | 'revealed';

// Tidsoppsett (ms)
const FINAL_COUNT = 3; // De siste loddene som slukkes ett og ett, sakte
const FINAL_STEP = 1400; // Pause mellom hvert av de siste loddene

function shuffle<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function GridDrawReveal({
  tickets,
  eligibleNumbers,
}: {
  tickets: GridTicket[];
  eligibleNumbers: number[];
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
      result = await drawWinnerAction({ onlySold: true }); // Kun solgte lodd
    } catch {
      result = { success: false, message: 'Noe gikk galt under trekningen. Prøv igjen.' };
    }
    if (!result.success || !result.winner) {
      setPhase('idle');
      setError(result.message ?? 'Trekningen feilet.');
      return;
    }

    const w = result.winner;
    const losers = shuffle(eligibleNumbers.filter(n => n !== w.number));
    const finalCount = Math.min(FINAL_COUNT, losers.length);
    const main = losers.slice(0, losers.length - finalCount);
    const final = losers.slice(losers.length - finalCount);

    // Hovedfasen: mange lodd slukkes raskt i starten, så stadig saktere
    const mainMs = main.length ? Math.min(7000, 1500 + main.length * 40) : 0;
    setPhase('eliminating');
    main.forEach((n, i) => later(mainMs * Math.pow((i + 1) / main.length, 1.8), () => eliminate(n)));

    // Sluttfasen: de siste loddene slukkes ett og ett mens resten pulserer
    later(mainMs, () => setPhase('final'));
    // Alle unntatt det aller siste loddet slukkes her …
    const lastLoser = final.at(-1);
    final.slice(0, -1).forEach((n, i) => later(mainMs + FINAL_STEP * (i + 1), () => eliminate(n)));

    // … og det siste slukkes i samme øyeblikk som vinneren avsløres, slik at
    // avsløringen kommer akkurat når bare vinnerloddet står igjen
    const revealAt = mainMs + FINAL_STEP * finalCount;
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

  const remaining = eligibleNumbers.filter(n => !eliminated.has(n)).length;

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full">
        {/* Rutenettet */}
        {/* På md+ er det 20 kolonner x 10 rader, og høyden tilpasses skjermen slik at
            alle 200 lodd alltid er synlige uten scrolling */}
        <div className="grid grid-cols-10 md:grid-cols-20 md:grid-rows-10 gap-1 md:gap-1.5 w-full md:h-[max(20rem,calc(100vh-22rem))]">
          {tickets.map(t => (
            <Cell
              key={t.number}
              ticket={t}
              state={
                winner?.number === t.number
                  ? 'winner'
                  : !eligible.has(t.number)
                    ? 'out'
                    : eliminated.has(t.number) || phase === 'revealed'
                      ? 'eliminated'
                      : phase === 'final'
                        ? 'finalist'
                        : 'pool'
              }
            />
          ))}
        </div>

        {/* Vinnerkort – z-50 så det alltid ligger foran loddene (som har z-10/z-20) */}
        {showCard && winner && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto wine-card-bg border-2 border-[#D4AF37] rounded-3xl px-10 py-8 md:px-16 md:py-10 text-center shadow-[0_0_80px_rgba(212,175,55,0.45)] pop-in">
              <div className="font-mono font-bold text-7xl md:text-9xl text-[#D4AF37] tracking-tighter">
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
          <button onClick={reset} className="wine-text-muted hover:text-[#D4AF37] transition-colors text-lg">
            Gjør klar til neste
          </button>
        ) : (
          <button
            onClick={handleDraw}
            disabled={isRunning || eligibleNumbers.length === 0}
            className="px-10 py-4 bg-[#722F37] text-white font-bold text-xl uppercase tracking-widest rounded-lg shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#8a3842] transition-all hover:scale-105 active:scale-95"
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

// Fargene følger salgssiden: ledige lodd = «ticket-available» med gullnummer,
// solgte lodd = «ticket-taken» med navn. I trekningen vises alltid nummeret.
function Cell({ ticket, state }: { ticket: GridTicket; state: CellState }) {
  const sold = !!ticket.ownerName;
  const base = sold ? 'ticket-taken' : 'ticket-available';

  const look: Record<CellState, string> = {
    pool: base,
    finalist: `${base} border-2 border-[#D4AF37]! animate-pulse scale-110 z-10 shadow-[0_0_20px_rgba(212,175,55,0.6)]`,
    eliminated: `${base} opacity-25 scale-95`,
    // Ikke med i potten:
    // - vunnet (solgt): tydelig gull, som på salgssiden – dette er dagens vinnere
    // - trukket, men usolgt: dempet og gjennomstreket
    // - eieren har allerede vunnet: dempet
    out: ticket.hasWon && sold
      ? 'bg-gradient-to-br from-[#D4AF37] to-[#8a6e1f] border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)] z-10'
      : `${base} opacity-25 ${ticket.hasWon ? 'line-through' : ''}`,
    winner: 'bg-gradient-to-br from-[#D4AF37] to-[#8a6e1f] border-[#D4AF37] scale-125 z-20 shadow-[0_0_40px_rgba(212,175,55,0.9)]',
  };

  const gold = state === 'winner' || (state === 'out' && ticket.hasWon && sold);

  return (
    <div
      className={`min-h-10 md:min-h-0 flex flex-col items-center justify-center rounded border overflow-hidden transition-all duration-500 ${look[state]}`}
      title={ticket.ownerName ?? 'Ikke solgt'}
    >
      <span
        className={`font-serif font-bold leading-none text-sm lg:text-base 2xl:text-xl ${
          gold ? 'text-[#1a0b0e]' : sold ? 'wine-text' : 'text-[#D4AF37]/80'
        }`}
      >
        {ticket.number}
      </span>
      {sold && (
        <span
          className={`hidden lg:block font-mono leading-tight truncate w-full px-0.5 text-center text-[9px] 2xl:text-[11px] ${
            gold ? 'text-[#1a0b0e]/80' : 'wine-text-muted'
          }`}
        >
          {shortName(ticket.ownerName!)}
        </span>
      )}
    </div>
  );
}
