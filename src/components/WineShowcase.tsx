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
    <section>
      <p className="wine-text-muted text-sm mb-3.5">
        {confirmed ? count : `Forslag til ${count.charAt(0).toLowerCase()}${count.slice(1)}`}
      </p>
      {!confirmed && (
        <p className="mb-3">
          <span className="inline-block px-2.5 py-0.5 rounded-full border wine-accent-soft-border wine-accent text-xs">
            Forslag – endelige viner bekreftes når de er kjøpt
          </span>
        </p>
      )}
      <div className="flex flex-col gap-2.5">
        {wines.map(wine => {
          const { name, details } = splitInfo(wine.info);
          return (
            <button
              key={wine.id}
              type="button"
              onClick={() => setOpen(wine)}
              className="group wine-card-bg wine-card-interactive border wine-border-faint rounded-lg px-4 py-3 flex items-center gap-3.5 text-left"
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
                <WineIcon aria-hidden className="w-[18px] h-[26px] shrink-0 wine-text-subtle" />
              )}
              <div className="min-w-0 flex-1">
                <p className="wine-text text-[15px] font-medium truncate">{name}</p>
                {details && <p className="font-mono wine-text-muted text-xs truncate mt-0.5">{details}</p>}
              </div>
              <ChevronRight aria-hidden className="wine-chevron w-4 h-4 shrink-0 wine-text-subtle transition-colors" />
            </button>
          );
        })}
      </div>

      {/* AI-oppsummering av ukens viner */}
      {summary && (
        <p className="mt-4 wine-card-alpha border border-dashed wine-border-strong rounded-lg px-4 py-3.5 flex gap-2.5 items-start wine-text-muted text-[13px] italic leading-relaxed">
          <Sparkles aria-hidden className="w-4 h-4 shrink-0 mt-0.5 wine-accent not-italic" />
          <span>{summary}</span>
        </p>
      )}

      {open && <WineDialog wine={{ ...open, wineId: open.id }} onClose={() => setOpen(null)} />}
    </section>
  );
}

