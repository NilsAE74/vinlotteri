'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { drawWinnerAction } from '@/lib/admin-actions';
import { fireConfetti, playWinSound, speakWinner } from './drawEffects';

// Trekningsvisning: lykkehjul.
//
// - Ett felt per deltaker i potten (kun solgte lodd), med navnet på feltet.
//   Feltet er like stort som deltakerens andel av loddene i potten.
// - Serveren trekker vinnerloddet FØR hjulet spinner. Hjulet stopper alltid
//   på feltet til eieren av loddet serveren valgte.
// - Navnet under pilen lyser opp under hjulet mens det spinner.

type PotTicket = { number: number; ownerName: string };
type Winner = { number: number; owner: string | null };
type Phase = 'idle' | 'waiting' | 'spinning' | 'landed' | 'revealed';
type Segment = { name: string; count: number; start: number; end: number; color: string };

const SPIN_MS = 8500; // Hvor lenge hjulet spinner
const EXTRA_TURNS = 7; // Hele runder før det stopper
const CARD_DELAY = 1200; // Fra hjulet stopper til vinnerkortet vises
const COLORS = ['#7A2B35', '#5A2229', '#943440'];

// Hjulvinkel (grader, med klokka fra toppen) → punkt på sirkelen
const point = (deg: number, r: number) => {
  const rad = (deg * Math.PI) / 180;
  return [Math.sin(rad) * r, -Math.cos(rad) * r];
};

function buildSegments(pot: PotTicket[]): Segment[] {
  const counts = new Map<string, number>();
  for (const t of pot) {
    const name = t.ownerName.trim();
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  const names = [...counts.keys()].sort((a, b) => a.localeCompare(b, 'nb'));
  const total = pot.length;
  let angle = 0;
  return names.map((name, i) => {
    const size = (counts.get(name)! / total) * 360;
    // Unngå at første og siste felt får samme farge
    let color = COLORS[i % COLORS.length];
    if (i === names.length - 1 && i > 0 && i % COLORS.length === 0) color = COLORS[1];
    const seg = { name, count: counts.get(name)!, start: angle, end: angle + size, color };
    angle += size;
    return seg;
  });
}

export default function WheelDrawReveal({ pot }: { pot: PotTicket[] }) {
  const router = useRouter();
  const liveSegments = useMemo(() => buildSegments(pot), [pot]);
  // Hjulet fryses under en trekning, så det ikke endrer seg når siden oppdateres
  const [frozen, setFrozen] = useState<Segment[] | null>(null);
  const segments = frozen ?? liveSegments;

  const [phase, setPhase] = useState<Phase>('idle');
  const [rotation, setRotation] = useState(0);
  const [pointerName, setPointerName] = useState<string | null>(null);
  const [winner, setWinner] = useState<Winner | null>(null);
  const [showCard, setShowCard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wheelRef = useRef<SVGGElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const raf = useRef<number | null>(null);

  const isRunning = phase === 'waiting' || phase === 'spinning';

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

  // Følg hjulets faktiske vinkel og vis navnet under pilen
  const trackPointer = (segs: Segment[]) => {
    const el = wheelRef.current;
    if (el) {
      const m = new DOMMatrixReadOnly(getComputedStyle(el).transform);
      const deg = (Math.atan2(m.b, m.a) * 180) / Math.PI;
      const underPointer = (((-deg) % 360) + 360) % 360;
      const seg = segs.find(s => underPointer >= s.start && underPointer < s.end);
      if (seg) setPointerName(prev => (prev === seg.name ? prev : seg.name));
    }
    raf.current = requestAnimationFrame(() => trackPointer(segs));
  };

  const handleDraw = async () => {
    if (segments.length === 0) return;
    stopAll();
    setError(null);
    setWinner(null);
    setShowCard(false);
    const segs = liveSegments;
    setFrozen(segs);
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
    const seg = segs.find(s => s.name === w.owner?.trim());

    // Lande et tilfeldig sted inne i vinnerens felt (ikke helt ute i kanten)
    const width = seg ? seg.end - seg.start : 0;
    const landAt = seg ? seg.start + width * (0.15 + Math.random() * 0.7) : Math.random() * 360;
    // Hjulvinkel a havner under pilen (toppen) når rotasjonen er -a (mod 360)
    const current = ((rotation % 360) + 360) % 360;
    const delta = (((-landAt - current) % 360) + 360) % 360;
    const finalRotation = rotation + EXTRA_TURNS * 360 + delta;

    setPhase('spinning');
    // Vent én frame så overgangen starter fra nåværende vinkel
    requestAnimationFrame(() => setRotation(finalRotation));
    raf.current = requestAnimationFrame(() => trackPointer(segs));

    later(SPIN_MS + 100, () => {
      if (raf.current !== null) cancelAnimationFrame(raf.current);
      raf.current = null;
      setPointerName(w.owner);
      setWinner(w);
      setPhase('landed');
    });
    later(SPIN_MS + 100 + CARD_DELAY, () => {
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
    stopAll();
    setPhase('idle');
    setWinner(null);
    setShowCard(false);
    setPointerName(null);
    setFrozen(null); // Hjulet bygges på nytt uten vinneren
  };

  const done = phase === 'landed' || phase === 'revealed';

  return (
    <div className="w-full flex flex-col items-center">
      <div className="relative w-[min(62vh,90vw)] aspect-square">
        {/* Pil på toppen */}
        <div className="absolute left-1/2 -translate-x-1/2 -top-3 z-20 drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]">
          <svg width="44" height="52" viewBox="0 0 44 52" aria-hidden="true">
            <path d="M22 50 L4 6 Q22 -4 40 6 Z" className="wheel-trim wheel-trim-stroke" strokeWidth="2" />
          </svg>
        </div>

        <svg viewBox="-105 -105 210 210" className="w-full h-full" role="img" aria-label="Lykkehjul">
          {/* Ytterring */}
          <circle r="104" className="wheel-plate wheel-trim-stroke" strokeWidth="2" />

          <g
            ref={wheelRef}
            style={{
              // Roter rundt hjulets sentrum (fill-box = hjulets egen boks)
              transformBox: 'fill-box',
              transformOrigin: 'center',
              transform: `rotate(${rotation}deg)`,
              transition: phase === 'spinning' ? `transform ${SPIN_MS}ms cubic-bezier(0.12, 0.75, 0.1, 1)` : 'none',
            }}
          >
            {segments.length === 0 ? (
              <circle r="100" className="wheel-plate" />
            ) : segments.length === 1 ? (
              <SegmentShape seg={segments[0]} full dim={false} highlight={done} />
            ) : (
              segments.map(seg => (
                <SegmentShape
                  key={seg.name}
                  seg={seg}
                  dim={done && seg.name !== winner?.owner?.trim()}
                  highlight={done && seg.name === winner?.owner?.trim()}
                />
              ))
            )}
          </g>

          {/* Nav i midten */}
          <circle r="14" className="wheel-plate wheel-trim-stroke" strokeWidth="2.5" />
          <circle r="5" className="wheel-trim" />
        </svg>

        {/* Vinnerkort – z-50 så det ligger foran hjulet */}
        {showCard && winner && (
          <div className="absolute inset-0 z-50 flex items-center justify-center pointer-events-none">
            <div className="winner-card pointer-events-auto rounded-3xl px-10 py-8 md:px-14 md:py-10 text-center pop-in">
              <div className="font-mono font-bold text-7xl md:text-8xl wine-accent tracking-tighter">#{winner.number}</div>
              <div className="text-3xl md:text-5xl font-serif wine-text mt-3">{winner.owner}</div>
            </div>
          </div>
        )}
      </div>

      {/* Navnet under pilen */}
      <div className="mt-6 h-14 md:h-16 min-w-[16rem] flex items-center justify-center rounded-xl bg-black/30 border border-white/10 px-8">
        {pointerName && phase !== 'idle' && phase !== 'waiting' ? (
          <span
            key={pointerName}
            className={`font-serif text-3xl md:text-4xl wine-accent truncate ${
              done ? 'drop-shadow-[0_0_20px_rgba(199,154,62,0.9)]' : 'name-flash'
            }`}
          >
            {pointerName}
          </span>
        ) : (
          <span className="font-serif text-2xl md:text-3xl wine-text-subtle">
            {phase === 'waiting' ? 'Trekker…' : `${segments.length} deltakere`}
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
            disabled={isRunning || phase === 'landed' || segments.length === 0}
            className="wine-cta px-10 py-4 font-bold text-xl rounded-lg shadow-xl disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform"
          >
            {isRunning || phase === 'landed' ? 'Trekker…' : 'Snurr hjulet'}
          </button>
        )}
      </div>
    </div>
  );
}

function SegmentShape({
  seg,
  full = false,
  dim,
  highlight,
}: {
  seg: Segment;
  full?: boolean;
  dim: boolean;
  highlight: boolean;
}) {
  const R = 100;
  const width = seg.end - seg.start;
  const mid = seg.start + width / 2;

  let path: string;
  if (full) {
    path = `M 0 -${R} A ${R} ${R} 0 1 1 0 ${R} A ${R} ${R} 0 1 1 0 -${R} Z`;
  } else {
    const [x0, y0] = point(seg.start, R);
    const [x1, y1] = point(seg.end, R);
    path = `M 0 0 L ${x0} ${y0} A ${R} ${R} 0 ${width > 180 ? 1 : 0} 1 ${x1} ${y1} Z`;
  }

  // Navnet langs radien, lest utover fra midten. På venstre halvdel snus det,
  // så det aldri står opp-ned.
  const labelR = 60;
  const arc = (labelR * width * Math.PI) / 180; // Plass på tvers av feltet
  const fontSize = Math.max(3.5, Math.min(10, arc * 0.6));
  const maxChars = 16;
  const label = seg.name.length > maxChars ? `${seg.name.slice(0, maxChars - 1)}…` : seg.name;
  const flip = mid > 180;

  return (
    <g style={{ opacity: dim ? 0.25 : 1, transition: 'opacity 600ms' }}>
      <path
        d={path}
        fill={highlight ? 'var(--wine-accent)' : seg.color}
        stroke="var(--wine-accent)"
        strokeOpacity={0.6}
        strokeWidth={0.6}
      />
      <g transform={`rotate(${mid - 90})`}>
        <text
          x={labelR}
          y={0}
          transform={flip ? `rotate(180 ${labelR} 0)` : undefined}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontFamily="var(--font-fraunces), serif"
          fontWeight={700}
          fill={highlight ? 'var(--wine-ink)' : '#F3ECE2'}
        >
          {label}
        </text>
      </g>
    </g>
  );
}
