'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { drawWinnerAction } from '@/lib/admin-actions';
import { fireConfetti, playWinSound, speakWinner } from './drawEffects';

// Trekningsvisning: glassrace.
//
// - Hver deltaker i potten (kun solgte lodd) får ett fullt vinglass.
// - Glassene tømmes i ujevne slurker, og den som først tømmer glasset vinner.
// - Serveren trekker vinnerloddet FØR løpet starter. Bare vinnerens glass blir
//   helt tomt; de andre stopper litt før, slik at ledelsen kan skifte underveis,
//   men løpet alltid ender på vinneren serveren valgte.
//
// Internt regnes «hvor mye som er drukket» (0 = fullt, 1 = tomt).

type PotTicket = { number: number; ownerName: string };
type Winner = { number: number; owner: string | null };
type Phase = 'idle' | 'waiting' | 'racing' | 'finished' | 'revealed';
type Racer = { name: string; tickets: number };
type Plan = { curve: number[]; final: number; shape: number };

const RACE_MS = 14000; // Hvor lenge løpet varer
const RACE_MS_REDUCED = 2500; // Kortere og roligere ved redusert bevegelse
const CARD_DELAY = 1200; // Fra glasset er tomt til vinnerkortet vises
const STEPS = 28; // Antall «slurker» per glass

function buildRacers(pot: PotTicket[]): Racer[] {
  const counts = new Map<string, number>();
  for (const t of pot) {
    const name = t.ownerName.trim();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([name, tickets]) => ({ name, tickets }))
    .sort((a, b) => a.name.localeCompare(b.name, 'nb'));
}

// Ujevn, stigende kurve fra 0 til 1: noen slurker er store, andre nesten ingenting
function pourCurve() {
  const steps = Array.from({ length: STEPS }, () => Math.random() ** 2.5);
  const total = steps.reduce((a, b) => a + b, 0) || 1;
  let acc = 0;
  return [0, ...steps.map(s => (acc += s / total))];
}

// Lager løpsplanen. Vinneren ender på 1 (tomt) med en sterk avslutning;
// et par utfordrere kommer nesten helt opp, resten stopper lenger ned. Flere
// lodd gir i snitt litt raskere drikking, så løpet speiler oddsen.
function planRace(racers: Racer[], winnerName: string | null): Plan[] {
  const maxTickets = Math.max(1, ...racers.map(r => r.tickets));
  const challengers = new Set(
    racers
      .filter(r => r.name !== winnerName)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2)
      .map(r => r.name)
  );
  return racers.map(r => {
    if (r.name === winnerName) return { curve: pourCurve(), final: 1, shape: 1.25 + Math.random() * 0.35 };
    const final = challengers.has(r.name)
      ? 0.9 + Math.random() * 0.07
      : 0.55 + 0.25 * Math.random() + 0.12 * (r.tickets / maxTickets);
    return { curve: pourCurve(), final: Math.min(final, 0.97), shape: 0.7 + Math.random() * 0.5 };
  });
}

// Andel drukket ved tid t (0–1)
function levelAt(plan: Plan, t: number) {
  const u = Math.min(1, Math.max(0, t)) ** plan.shape * STEPS;
  const i = Math.min(STEPS - 1, Math.floor(u));
  const v = plan.curve[i] + (plan.curve[i + 1] - plan.curve[i]) * (u - i);
  return v * plan.final;
}

// Kortnavn som på salgssiden: «Ola Nordmann» → «Ola N.»
function shortName(name: string) {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

// Antall rader glassene fordeles på, ut fra antall deltakere
function columnsFor(n: number) {
  const rows = n <= 10 ? 1 : n <= 26 ? 2 : n <= 54 ? 3 : 4;
  return Math.max(1, Math.ceil(n / rows));
}

export default function GlassRaceReveal({ pot }: { pot: PotTicket[] }) {
  const router = useRouter();
  const liveRacers = useMemo(() => buildRacers(pot), [pot]);
  // Deltakerne fryses under en trekning, så glassene ikke endrer seg når siden oppdateres
  const [frozen, setFrozen] = useState<Racer[] | null>(null);
  const racers = frozen ?? liveRacers;

  const [phase, setPhase] = useState<Phase>('idle');
  const [levels, setLevels] = useState<number[]>([]);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const raf = useRef<number | null>(null);

  const isRunning = phase === 'waiting' || phase === 'racing';

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const stopAll = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    if (raf.current !== null) cancelAnimationFrame(raf.current);
    raf.current = null;
  };
  useEffect(() => stopAll, []);

  const handleDraw = async () => {
    if (liveRacers.length === 0) return;
    stopAll();
    setError(null);
    setWinner(null);
    setShowCard(false);
    const field = liveRacers;
    setFrozen(field);
    setLevels(field.map(() => 0));
    setPhase('waiting');

    let result: Awaited<ReturnType<typeof drawWinnerAction>>;
    try {
      result = await drawWinnerAction({ onlySold: true }); // Kun solgte lodd
    } catch {
      result = { success: false, message: 'Noe gikk galt under trekningen. Prøv igjen.' };
    }
    if (!result.success || !result.winner) {
      setPhase('idle');
      setFrozen(null);
      setError(result.message ?? 'Trekningen feilet.');
      return;
    }

    const w = result.winner;
    const plans = planRace(field, w.owner?.trim() ?? null);
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? RACE_MS_REDUCED : RACE_MS;
    const start = performance.now();

    setPhase('racing');
    const tick = (now: number) => {
      const t = (now - start) / duration;
      setLevels(plans.map(p => levelAt(p, t)));
      if (t < 1) {
        raf.current = requestAnimationFrame(tick);
        return;
      }
      raf.current = null;
      setWinner(w);
      setPhase('finished');
      later(CARD_DELAY, () => {
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
    raf.current = requestAnimationFrame(tick);
  };

  const reset = () => {
    stopAll();
    setPhase('idle');
    setWinner(null);
    setShowCard(false);
    setLevels([]);
    setFrozen(null); // Nye, fulle glass uten vinneren
  };

  const done = phase === 'finished' || phase === 'revealed';
  const winnerName = winner?.owner?.trim() ?? null;

  // Hvem leder akkurat nå
  let leader: string | null = null;
  if (phase === 'racing' && levels.length === racers.length) {
    let best = 0;
    for (let i = 0; i < levels.length; i++) {
      if (levels[i] > best) {
        best = levels[i];
        leader = racers[i].name;
      }
    }
  }

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-full">
        {racers.length === 0 ? (
          <p className="py-24 text-xl wine-text-subtle">Ingen solgte lodd i potten.</p>
        ) : (
          <ul
            className="race-grid grid gap-x-2 gap-y-5 md:gap-x-3 w-full"
            style={{ '--race-cols': columnsFor(racers.length) } as React.CSSProperties}
            aria-label="Glassrace"
          >
            {racers.map((r, i) => {
              const isWinner = done && r.name === winnerName;
              return (
                <li
                  key={r.name}
                  className={`flex flex-col items-center min-w-0 transition-opacity duration-700 ${
                    done && !isWinner ? 'opacity-30' : ''
                  }`}
                >
                  <WineGlass level={1 - (levels[i] ?? 0)} highlight={isWinner} />
                  <span
                    className={`mt-1 w-full truncate text-center font-medium text-xs lg:text-sm 2xl:text-base ${
                      isWinner ? 'wine-accent' : 'wine-text'
                    }`}
                    title={r.name}
                  >
                    {shortName(r.name)}
                  </span>
                  <span className="text-[10px] lg:text-xs wine-text-subtle tabular-nums">
                    {r.tickets} lodd
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        {/* Vinnerkort – z-50 så det ligger foran glassene */}
        {showCard && winner && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="winner-card pointer-events-auto rounded-3xl px-10 py-8 md:px-14 md:py-10 text-center pop-in">
              <div className="font-mono font-bold text-7xl md:text-8xl wine-accent tracking-tighter">#{winner.number}</div>
              <div className="text-3xl md:text-5xl font-serif wine-text mt-3">{winner.owner}</div>
            </div>
          </div>
        )}
      </div>

      {/* Hvem leder */}
      <div className="mt-6 h-14 md:h-16 min-w-[16rem] flex items-center justify-center px-8" aria-live="polite">
        {phase === 'racing' && leader ? (
          <span className="font-serif text-2xl md:text-3xl wine-text-muted truncate">
            I ledelsen: <span className="wine-accent">{leader}</span>
          </span>
        ) : done && winnerName ? (
          <span className="font-serif text-2xl md:text-3xl wine-accent truncate">{winnerName} tømte glasset først</span>
        ) : (
          <span className="font-serif text-2xl md:text-3xl wine-text-subtle">
            {phase === 'waiting' ? 'Drikker…' : `${racers.length} fulle glass står klare`}
          </span>
        )}
      </div>

      {error && <p className="mt-4 text-red-500">{error}</p>}

      <div className="mt-4 h-16 flex items-center">
        {phase === 'revealed' ? (
          <button onClick={reset} className="wine-link transition-colors text-lg">
            Gjør klar til neste
          </button>
        ) : (
          <button
            onClick={handleDraw}
            disabled={isRunning || phase === 'finished' || racers.length === 0}
            className="wine-cta px-10 py-4 font-bold text-xl rounded-lg shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform"
          >
            {isRunning || phase === 'finished' ? 'Drikker…' : 'Start drikkingen'}
          </button>
        )}
      </div>
    </div>
  );
}

// Et stettglass. Vinen er et rektangel klippet av bollen; level 1 er fullt
// (overflaten like under kanten, TOP) og 0 er tomt (bunnen av bollen, BOTTOM).
const TOP = 9;
const BOTTOM = 62;
const BOWL = 'M8 4 C7 24 9 46 22 58 C26 62 34 62 38 58 C51 46 53 24 52 4 Z';

function WineGlass({ level, highlight }: { level: number; highlight: boolean }) {
  const y = BOTTOM - (BOTTOM - TOP) * level;
  // Unik id per glass for klippebanen
  const clipId = `bowl-${useId().replace(/:/g, '')}`;

  return (
    <svg
      viewBox="0 0 60 104"
      className={`w-full max-w-[7.5rem] max-h-[22vh] wine-text-muted ${
        highlight ? 'race-glass-winner' : ''
      }`}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={clipId}>
          <path d={BOWL} />
        </clipPath>
      </defs>

      {/* Vinen */}
      <g clipPath={`url(#${clipId})`}>
        <rect x="0" y={y} width="60" height={BOTTOM - y + 4} fill="#722F37" />
        {level > 0.01 && (
          <ellipse cx="30" cy={y} rx="24" ry="1.6" fill="#8a3842" />
        )}
      </g>

      {/* Glasset: bolle, stett og fot */}
      <path
        d={BOWL}
        fill="currentColor"
        fillOpacity={0.06}
        stroke={highlight ? 'var(--wine-accent)' : 'currentColor'}
        strokeWidth={highlight ? 2 : 1.4}
        strokeLinejoin="round"
      />
      <path d="M30 61 V92" stroke={highlight ? 'var(--wine-accent)' : 'currentColor'} strokeWidth={highlight ? 2.4 : 1.8} />
      <path
        d="M16 98 Q30 90 44 98 Z"
        fill="currentColor"
        fillOpacity={0.1}
        stroke={highlight ? 'var(--wine-accent)' : 'currentColor'}
        strokeWidth={highlight ? 2 : 1.4}
        strokeLinejoin="round"
      />
      {/* Lysrefleks på glasset */}
      <path d="M14 10 C13 22 14 34 19 44" stroke="currentColor" strokeOpacity={0.35} strokeWidth={1.4} fill="none" strokeLinecap="round" />
    </svg>
  );
}
