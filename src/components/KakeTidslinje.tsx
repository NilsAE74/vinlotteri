'use client';

import { useEffect, useRef } from 'react';
import { Check } from 'lucide-react';

export type KakeUke = {
  aar: number;
  uke: number;
  navn: string[];
};

interface KakeTidslinjeProps {
  /** Kun ukene som står i kakelisten, sortert stigende på år og uke. */
  uker: KakeUke[];
  /** Inneværende ISO-år og ukenummer. */
  currentYear: number;
  currentWeek: number;
}

/**
 * Vannrett tidslinje over kakebakere. Viser bare ukene som finnes i kakelisten –
 * uker uten kake hoppes over. Neste (eller inneværende) kakeuke er uthevet og
 * sentreres automatisk.
 */
export default function KakeTidslinje({ uker, currentYear, currentWeek }: KakeTidslinjeProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const focusRef = useRef<HTMLLIElement>(null);

  // Første kakeuke som ikke er passert. Finnes ingen, er alle passert.
  const now = currentYear * 100 + currentWeek;
  const focusIndex = uker.findIndex(u => u.aar * 100 + u.uke >= now);

  useEffect(() => {
    const scroller = scrollerRef.current;
    const focus = focusRef.current;
    if (!scroller) return;
    if (!focus) {
      scroller.scrollLeft = scroller.scrollWidth;
      return;
    }
    // Sentrer kortet uten å rulle selve siden vertikalt.
    scroller.scrollLeft = focus.offsetLeft - (scroller.clientWidth - focus.clientWidth) / 2;
  }, [focusIndex]);

  // --- Dra med mus. Fingre på mobil bruker nettleserens egen rulling. ---
  const drag = useRef<{ startX: number; startLeft: number } | null>(null);

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const scroller = e.currentTarget;
    drag.current = { startX: e.clientX, startLeft: scroller.scrollLeft };
    scroller.setPointerCapture(e.pointerId);
    scroller.classList.add('is-dragging');
  };

  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    e.currentTarget.scrollLeft = drag.current.startLeft - (e.clientX - drag.current.startX);
  };

  const endDrag = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    const scroller = e.currentTarget;
    scroller.classList.remove('is-dragging');
    // Legg nærmeste kort pent i midten når man slipper.
    const mid = scroller.scrollLeft + scroller.clientWidth / 2;
    let target: HTMLElement | null = null;
    let best = Infinity;
    scroller.querySelectorAll<HTMLElement>('li').forEach(li => {
      const dist = Math.abs(li.offsetLeft + li.offsetWidth / 2 - mid);
      if (dist < best) { best = dist; target = li; }
    });
    if (target) {
      const t = target as HTMLElement;
      scroller.scrollTo({ left: t.offsetLeft - (scroller.clientWidth - t.offsetWidth) / 2, behavior: 'smooth' });
    }
  };

  if (uker.length === 0) return null;

  return (
    <section aria-label="Kakebakere" className="mb-5">
      <div
        ref={scrollerRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        className="overflow-x-auto snap-x snap-mandatory scroll-smooth kake-scroller"
      >
        <ol className="flex items-center gap-3 w-max mx-auto px-[calc(50%-4.5rem)] py-4 select-none">
          {uker.map((u, i) => {
            const isPast = focusIndex === -1 || i < focusIndex;
            const isFocus = i === focusIndex;
            const isThisWeek = isFocus && u.aar * 100 + u.uke === now;
            // Vis årstall på første kort i hvert år
            const nyttAar = i === 0 || uker[i - 1].aar !== u.aar;
            const navn = u.navn.join(' & ');

            return (
              <li
                key={`${u.aar}-${u.uke}`}
                ref={isFocus ? focusRef : undefined}
                aria-current={isFocus ? 'true' : undefined}
                title={isFocus ? undefined : `Uke ${u.uke}, ${u.aar}: ${navn}`}
                className={[
                  // Kortet for aktuell kakebaker er h-32, de andre halvparten (h-16).
                  'relative snap-center shrink-0 w-36 rounded-xl border px-3 text-center transition-all flex flex-col justify-center',
                  isFocus
                    ? 'h-32 py-3 kake-focus wine-card-bg border-[#D4AF37]'
                    : 'h-16 py-2 wine-card-alpha wine-border-faint',
                  isPast ? 'opacity-45' : '',
                ].join(' ')}
              >
                {nyttAar && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-[#D4AF37]/50 wine-card-bg px-2 text-[10px] leading-4 tracking-widest text-[#D4AF37]">
                    {u.aar}
                  </span>
                )}

                {isFocus ? (
                  <>
                    <div className="text-[10px] uppercase tracking-widest text-[#D4AF37]">
                      {isThisWeek ? 'Denne uka' : 'Neste kake'} <span aria-hidden>🎂</span>
                    </div>
                    <div className="font-serif text-2xl text-[#D4AF37] leading-tight">Uke {u.uke}</div>
                    <div className="mt-1 wine-text text-base font-medium leading-snug line-clamp-2 break-words">
                      {navn}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex items-center justify-center gap-1 text-[10px] uppercase tracking-widest wine-text-subtle">
                      Uke {u.uke}
                      {isPast && <Check className="w-3 h-3 text-[#D4AF37]/70" aria-label="Ferdig" />}
                    </div>
                    <div className="wine-text-muted text-sm font-medium truncate">{navn}</div>
                  </>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
