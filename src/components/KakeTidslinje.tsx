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

  if (uker.length === 0) return null;

  return (
    <section aria-label="Kakebakere" className="mb-10">
      <h2 className="text-center text-xs uppercase tracking-widest text-[#D4AF37]/80 mb-3">
        Kakebakere 🎂
      </h2>

      <div className="relative">
        <div
          ref={scrollerRef}
          className="overflow-x-auto snap-x snap-mandatory scroll-smooth kake-scroller"
        >
          <ol className="flex items-stretch gap-3 w-max mx-auto px-[calc(50%-4.5rem)] py-4">
            {uker.map((u, i) => {
              const isPast = focusIndex === -1 || i < focusIndex;
              const isFocus = i === focusIndex;
              const isThisWeek = isFocus && u.aar * 100 + u.uke === now;
              // Vis årstall på første kort i hvert år
              const nyttAar = i === 0 || uker[i - 1].aar !== u.aar;

              return (
                <li
                  key={`${u.aar}-${u.uke}`}
                  ref={isFocus ? focusRef : undefined}
                  aria-current={isFocus ? 'true' : undefined}
                  className={[
                    'relative snap-center shrink-0 w-36 rounded-xl border px-3 py-3 text-center transition-all',
                    isFocus
                      ? 'kake-focus wine-card-bg border-[#D4AF37] scale-105'
                      : 'wine-card-alpha wine-border-faint',
                    isPast ? 'opacity-45' : '',
                  ].join(' ')}
                >
                  {nyttAar && (
                    <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 rounded-full border border-[#D4AF37]/50 wine-card-bg px-2 text-[10px] leading-4 tracking-widest text-[#D4AF37]">
                      {u.aar}
                    </span>
                  )}
                  <div
                    className={`text-[10px] uppercase tracking-widest ${
                      isFocus ? 'text-[#D4AF37]' : 'wine-text-subtle'
                    }`}
                  >
                    {isFocus ? (isThisWeek ? 'Denne uka' : 'Neste kake') : `Uke ${u.uke}`}
                  </div>

                  {isFocus && (
                    <div className="font-serif text-2xl text-[#D4AF37] leading-tight">Uke {u.uke}</div>
                  )}

                  <div
                    className={`mt-1 font-medium leading-snug break-words ${
                      isFocus ? 'wine-text text-base' : 'wine-text-muted text-sm'
                    }`}
                  >
                    {u.navn.join(' & ')}
                  </div>

                  <div className="mt-1 h-5 flex items-center justify-center text-sm">
                    {isPast ? (
                      <Check className="w-4 h-4 text-[#D4AF37]/70" aria-label="Ferdig" />
                    ) : isFocus ? (
                      <span aria-hidden>🎂</span>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </section>
  );
}
