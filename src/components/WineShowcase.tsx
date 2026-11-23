'use client';

import { useState } from 'react';
import { Wine as WineIcon, ChevronRight, Sparkles } from 'lucide-react';
import WineDialog from './WineDialog';

type WineItem = { id: number; info: string; imageUrl: string | null; productCode: string | null };

// Info lagres som «Navn – Land, distrikt – 75 cl · 14,5% · Kr …».
// Del i navn + detaljer så kortet kan vise dem på hver sin linje.
function splitInfo(info: string) {
  const [name, ...rest] = info.split(' – ');
  return { name: name.trim(), details: rest.join(' · ').trim() };
}

// «Ukens viner» på forsiden. Trykk på en vin for å se mer informasjon.
// Før admin har bekreftet vinene, vises de som et forslag.
export default function WineShowcase({
  wines,
  summary,
  confirmed = true,
}: {
  wines: WineItem[];
  summary?: string | null;
  confirmed?: boolean;
}) {
  const [open, setOpen] = useState<WineItem | null>(null);
  const count = wines.length === 1 ? 'Ukens vin' : `Ukens viner (${wines.length} flasker)`;

  return (
    <section className="mb-5">
      <h2 className="text-center text-[#D4AF37] text-xs uppercase tracking-widest mb-2">
        {confirmed ? count : `Forslag til ${count.charAt(0).toLowerCase()}${count.slice(1)}`}
      </h2>
      {!confirmed && (
        <p className="text-center mb-3">
          <span className="inline-block px-2.5 py-0.5 rounded-full border border-[#D4AF37]/50 text-[#D4AF37] text-xs">
            Forslag – endelige viner bekreftes når de er kjøpt
          </span>
        </p>
      )}
      {/* AI-oppsummering av ukens viner */}
      {summary && (
        <p className="max-w-2xl mx-auto text-center wine-text-muted text-sm italic leading-relaxed mb-3 px-2">
          {summary}
          <span className="not-italic wine-text-subtle text-xs whitespace-nowrap">
            {' '}<Sparkles aria-hidden className="inline w-3 h-3 -mt-0.5" /> AI
          </span>
        </p>
      )}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:justify-center gap-2 sm:gap-3 max-w-md sm:max-w-none mx-auto">
        {wines.map(wine => {
          const { name, details } = splitInfo(wine.info);
          return (
            <button
              key={wine.id}
              type="button"
              onClick={() => setOpen(wine)}
              className="group w-full sm:w-64 wine-card-alpha border border-[#722F37]/50 hover:border-[#D4AF37] rounded-lg px-3 py-2 flex items-center gap-3 text-left transition-colors"
              title={`${wine.info}
Trykk for mer info`}
            >
              {wine.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={wine.imageUrl}
                  alt=""
                  className="w-8 h-12 object-contain shrink-0 transition-transform group-hover:scale-110"
                />
              ) : (
                <WineIcon className="w-8 h-12 py-2 text-[#722F37] shrink-0" />
              )}
              <div className="min-w-0 flex-1">
                <p className="wine-text text-sm font-medium truncate">{name}</p>
                {details && <p className="wine-text-muted text-xs truncate">{details}</p>}
              </div>
              <ChevronRight
                aria-hidden
                className="w-4 h-4 shrink-0 text-[#D4AF37]/50 group-hover:text-[#D4AF37] transition-colors"
              />
            </button>
          );
        })}
      </div>

      {open && <WineDialog wine={{ ...open, wineId: open.id }} onClose={() => setOpen(null)} />}
    </section>
  );
}

