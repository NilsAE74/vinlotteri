'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { drawWinnerAction } from '@/lib/admin-actions';
import { fireConfetti, playWinSound, speakWinner } from './drawEffects';

// Trekningsvisning: spilleautomat med tre hjul (hundrer, tier, ener).
//
// - Hjulene er sifferstriper som ruller kontinuerlig, og stopper ett og ett
//   på vinnerens sifre (først hundrer, så tier, så ener).
// - Kun solgte lodd er med. Mens hjulene spinner, lyser eierne av solgte lodd
//   i potten opp under hjulene. Etter hvert stopp vises bare eiere av lodd som
//   passer med sifrene som allerede står.
// - Serveren trekker vinneren FØR animasjonen starter; animasjonen ender
//   alltid på loddet serveren valgte.

type PotTicket = { number: number; ownerName: string };
type Winner = { number: number; owner: string | null };
type Phase = 'idle' | 'waiting' | 'spinning' | 'revealed';

// Tidsoppsett (ms): hvor lenge det spinnes før hvert hjul stopper, tempo på
// navnene under, og rotasjonshastighet på hjulene (sekunder per runde 0–9)
const STAGES = [
  { duration: 2600, nameFrom: 80, nameTo: 110, reelSpeed: 0.22 }, // alle spinner → hundrer stopper
  { duration: 2400, nameFrom: 110, nameTo: 180, reelSpeed: 0.3 }, // tier + ener → tier stopper
  { duration: 3000, nameFrom: 180, nameTo: 450, reelSpeed: 0.45 }, // ener alene → ener stopper
];
const SLOW_DOWN_BEFORE_STOP = 1100; // Siste hjul går ekstra sakte de siste ms før stopp
const SLOW_SPEED = 0.8;
const CARD_DELAY = 1300; // Fra siste hjul stopper til vinnerkortet vises

const digitsOf = (n: number) => [Math.floor(n / 100) % 10, Math.floor(n / 10) % 10, n % 10];

export default function SlotDrawReveal({ pot }: { pot: PotTicket[] }) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('idle');
  const [target, setTarget] = useState<number[] | null>(null);
  const [locked, setLocked] = useState(0); // Antall hjul som har stoppet (0–3)
  const [speed, setSpeed] = useState(STAGES[0].reelSpeed);
  const [name, setName] = useState<string | null>(null);
  const [tick, setTick] = useState(0); // Øker ved hvert nytt navn (trigger blink)
  const [winner, setWinner] = useState<Winner | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const isRunning = phase === 'waiting' || phase === 'spinning';

  const later = (ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  };
  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };
  useEffect(() => clearTimers, []);

  const handleDraw = async () => {
    if (pot.length === 0) return;
    clearTimers();
    setError(null);
    setWinner(null);
    setShowCard(false);
    setTarget(null);
    setLocked(0);
    setName(null);
    setSpeed(STAGES[0].reelSpeed);
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
    const digits = digitsOf(w.number);
    setTarget(digits);
    setPhase('spinning');

    let t = 0;
    STAGES.forEach((stage, stageIndex) => {
      const start = t;
      later(start, () => setSpeed(stage.reelSpeed));

      // Navn som lyser opp: eiere av solgte lodd som passer med sifrene som står.
      // Vinneren holdes utenfor, så navnet ikke dukker opp før det er trukket.
      const matching = pot.filter(
        p => p.number !== w.number && digitsOf(p.number).slice(0, stageIndex).every((d, i) => d === digits[i])
      );
      let elapsed = 0;
      while (elapsed < stage.duration) {
        const progress = elapsed / stage.duration;
        const step = stage.nameFrom + (stage.nameTo - stage.nameFrom) * progress * progress;
        later(start + elapsed, () => {
          setName(matching.length ? matching[Math.floor(Math.random() * matching.length)].ownerName : null);
          setTick(x => x + 1);
        });
        elapsed += step;
      }
      t = start + stage.duration;

      // Siste hjul bremser ekstra ned rett før det stopper
      if (stageIndex === STAGES.length - 1) later(t - SLOW_DOWN_BEFORE_STOP, () => setSpeed(SLOW_SPEED));

      // Stopp neste hjul på vinnerens siffer
      later(t, () => setLocked(stageIndex + 1));
    });

    // Siste hjul har landet (settle-animasjonen tar ~900 ms): vis vinneren
    later(t + 900, () => {
      setName(w.owner);
      setTick(x => x + 1);
      setWinner(w);
      setPhase('revealed');
    });

    // Vinnerkort, konfetti, lyd og opplesning
    later(t + CARD_DELAY, () => {
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
    setTarget(null);
    setName(null);
    setLocked(0);
  };

  const reelState = (i: number): ReelState =>
    phase === 'waiting' || (phase === 'spinning' && i >= locked)
      ? 'spinning'
      : target && (phase === 'spinning' || phase === 'revealed')
        ? 'stopped'
        : 'idle';

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative">
        {/* Automaten */}
        <div className="rounded-3xl border-4 border-[#722F37] bg-gradient-to-b from-[#2a1216] to-[#0d0506] p-5 md:p-8 shadow-[0_0_60px_rgba(114,47,55,0.45)]">
          <div className="flex gap-3 md:gap-5">
            {[0, 1, 2].map(i => (
              <Reel
                key={i}
                state={reelState(i)}
                digit={target ? target[i] : null}
                speed={speed}
                isWinner={phase === 'revealed'}
              />
            ))}
          </div>

          {/* Navnet som lyser opp under hjulene */}
          <div className="mt-5 md:mt-7 h-14 md:h-20 flex items-center justify-center rounded-xl bg-black/40 border border-[#D4AF37]/20 px-6">
            {name ? (
              <span
                key={tick}
                className={`font-serif text-3xl md:text-5xl truncate text-[#D4AF37] ${
                  phase === 'revealed' ? 'drop-shadow-[0_0_20px_rgba(212,175,55,0.9)]' : 'name-flash'
                }`}
              >
                {name}
              </span>
            ) : (
              <span className="font-serif text-2xl md:text-4xl text-white/20">
                {phase === 'idle' ? 'Klar til trekning' : phase === 'waiting' ? 'Trekker…' : '· · ·'}
              </span>
            )}
          </div>
        </div>

        {/* Vinnerkort – z-50 så det ligger foran automaten */}
        {showCard && winner && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="pointer-events-auto wine-card-bg border-2 border-[#D4AF37] rounded-3xl px-10 py-8 md:px-16 md:py-10 text-center shadow-[0_0_80px_rgba(212,175,55,0.45)] pop-in">
              <div className="font-mono font-bold text-7xl md:text-9xl text-[#D4AF37] tracking-tighter">#{winner.number}</div>
              <div className="text-3xl md:text-5xl font-serif wine-text mt-3">{winner.owner}</div>
            </div>
          </div>
        )}
      </div>

      {error && <p className="mt-4 text-red-500">{error}</p>}

      <div className="mt-6 h-16 flex items-center">
        {phase === 'revealed' ? (
          <button onClick={reset} className="wine-text-muted hover:text-[#D4AF37] transition-colors text-lg">
            Gjør klar til neste
          </button>
        ) : (
          <button
            onClick={handleDraw}
            disabled={isRunning || pot.length === 0}
            className="px-10 py-4 bg-[#722F37] text-white font-bold text-xl uppercase tracking-widest rounded-lg shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#8a3842] transition-all hover:scale-105 active:scale-95"
          >
            {isRunning ? 'Trekker…' : 'Trekk vinner'}
          </button>
        )}
      </div>
    </div>
  );
}

type ReelState = 'idle' | 'spinning' | 'stopped';

// Stripe med sifrene 0–9 tre ganger. Hvert felt er like høyt som hjulet,
// så stripa er 30 hjulhøyder høy. translateY i % gjelder stripas egen høyde.
const STRIP = Array.from({ length: 30 }, (_, i) => i % 10);
const FIELD = 100 / STRIP.length; // Ett felt i % av stripa

function Reel({
  state,
  digit,
  speed,
  isWinner,
}: {
  state: ReelState;
  digit: number | null;
  speed: number;
  isWinner: boolean;
}) {
  const d = digit ?? 0;
  const stripStyle = {
    '--reel-speed': `${speed}s`,
    // Stopp: rull fra sifferet i første runde til samme siffer i andre runde
    '--reel-from': `${-d * FIELD}%`,
    '--reel-to': `${-(10 + d) * FIELD}%`,
  } as React.CSSProperties;

  return (
    <div
      className={`relative w-24 h-36 md:w-40 md:h-56 xl:w-48 xl:h-64 rounded-2xl overflow-hidden border-4 transition-colors duration-300 ${
        isWinner
          ? 'border-[#D4AF37] shadow-[0_0_40px_rgba(212,175,55,0.8)]'
          : state === 'stopped'
            ? 'border-[#D4AF37]/80'
            : 'border-[#722F37]'
      } bg-gradient-to-b from-[#e8e0d8] via-white to-[#e8e0d8]`}
    >
      {state === 'idle' ? (
        <div className="absolute inset-0 flex items-center justify-center font-mono font-bold text-7xl md:text-9xl xl:text-[10rem] leading-none text-[#1a0b0e]/30">
          –
        </div>
      ) : (
        <div
          className={`absolute inset-x-0 top-0 h-[3000%] ${state === 'spinning' ? 'reel-spin' : 'reel-settle'}`}
          style={stripStyle}
        >
          {STRIP.map((n, i) => (
            <div
              key={i}
              style={{ height: `${FIELD}%` }}
              className={`flex items-center justify-center font-mono font-bold text-7xl md:text-9xl xl:text-[10rem] leading-none ${
                isWinner ? 'text-[#722F37]' : 'text-[#1a0b0e]'
              }`}
            >
              {n}
            </div>
          ))}
        </div>
      )}
      {/* Skygge øverst og nederst for «trommel»-følelse */}
      <div className="absolute inset-x-0 top-0 h-1/4 bg-gradient-to-b from-black/40 to-transparent pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 h-1/4 bg-gradient-to-t from-black/40 to-transparent pointer-events-none" />
    </div>
  );
}
