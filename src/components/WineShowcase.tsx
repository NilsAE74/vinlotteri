'use client';

import { useEffect, useState } from 'react';
import { X, ExternalLink, Wine as WineIcon, UtensilsCrossed } from 'lucide-react';
import { getWineDetails } from '@/lib/wine-details';
import type { WineDetails } from '@/lib/wine-details-map';

type WineItem = { id: number; info: string; imageUrl: string | null; productCode: string | null };

// «Ukens viner» på forsiden. Trykk på en vin for å se mer informasjon.
export default function WineShowcase({ wines }: { wines: WineItem[] }) {
  const [open, setOpen] = useState<WineItem | null>(null);

  return (
    <section className="mb-8">
      <h2 className="text-center text-[#D4AF37] text-xs uppercase tracking-widest mb-4">
        {wines.length === 1 ? 'Ukens vin' : `Ukens viner (${wines.length} flasker)`}
      </h2>
      <div className="flex flex-wrap justify-center gap-4">
        {wines.map(wine => (
          <button
            key={wine.id}
            type="button"
            onClick={() => setOpen(wine)}
            className="group w-full sm:w-72 wine-card-alpha border border-[#722F37]/50 hover:border-[#D4AF37] rounded-xl p-4 flex items-center gap-4 text-left transition-colors"
            title="Vis mer info"
          >
            {wine.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={wine.imageUrl}
                alt=""
                className="w-16 h-16 object-contain shrink-0 transition-transform group-hover:scale-110"
              />
            ) : (
              <WineIcon className="w-16 h-16 p-3 text-[#722F37] shrink-0" />
            )}
            <div className="min-w-0">
              <p className="wine-text text-sm whitespace-pre-line">{wine.info}</p>
              <p className="text-[#D4AF37]/70 group-hover:text-[#D4AF37] text-xs mt-1">Trykk for mer info</p>
            </div>
          </button>
        ))}
      </div>

      {open && <WineDialog wine={open} onClose={() => setOpen(null)} />}
    </section>
  );
}

function WineDialog({ wine, onClose }: { wine: WineItem; onClose: () => void }) {
  const [details, setDetails] = useState<WineDetails | null>(null);
  const [loading, setLoading] = useState(!!wine.productCode);

  // Hent detaljer fra Vinmonopolet (kun for viner lagt til via søk)
  useEffect(() => {
    if (!wine.productCode) return;
    let cancelled = false;
    getWineDetails(wine.id)
      .then(d => !cancelled && setDetails(d))
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [wine.id, wine.productCode]);

  // Lukk med Esc, og lås scrolling bak vinduet
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [onClose]);

  const image = details?.imageUrl ?? wine.imageUrl;
  const title = details?.name ?? wine.info.split(' – ')[0];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto wine-card-bg border border-[#D4AF37]/60 rounded-2xl shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 p-2 rounded-full wine-text-muted hover:text-[#D4AF37]"
          aria-label="Lukk"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col sm:flex-row gap-6 p-6">
          {/* Bilde */}
          <div className="sm:w-48 shrink-0 flex items-center justify-center rounded-xl bg-white/90 p-4">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt={title} className="max-h-72 w-auto object-contain" />
            ) : (
              <WineIcon className="w-24 h-24 text-[#722F37]" />
            )}
          </div>

          {/* Info */}
          <div className="min-w-0 flex-1 space-y-4">
            <div className="pr-8">
              <h3 className="text-2xl font-serif text-[#D4AF37] leading-tight">{title}</h3>
              <p className="wine-text-muted text-sm mt-1 whitespace-pre-line">{wine.info}</p>
            </div>

            {loading && <p className="wine-text-subtle text-sm">Henter info fra Vinmonopolet…</p>}

            {details && (
              <>
                {details.facts.length > 0 && (
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    {details.facts.map(f => (
                      <div key={f.label} className="contents">
                        <dt className="wine-text-subtle">{f.label}</dt>
                        <dd className="wine-text">{f.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {/* Fylde, friskhet, garvestoffer … som måleskalaer (av 12) */}
                {details.characteristics.length > 0 && (
                  <div className="space-y-1.5">
                    {details.characteristics.map(c => (
                      <div key={c.label} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-3 text-sm">
                        <span className="wine-text-subtle">{c.label}</span>
                        <div
                          className="flex gap-0.5"
                          role="img"
                          aria-label={`${c.label}: ${c.value} av ${c.max}`}
                        >
                          {Array.from({ length: c.max }, (_, i) => (
                            <span
                              key={i}
                              className={`h-2 flex-1 rounded-sm ${i < c.value ? 'bg-[#D4AF37]' : 'bg-[#722F37]/30'}`}
                            />
                          ))}
                        </div>
                        <span className="wine-text-muted font-mono text-xs text-right">
                          {c.value}/{c.max}
                        </span>
                      </div>
                    ))}
                  </div>
                )}

                {details.notes.map(n => (
                  <div key={n.label}>
                    <h4 className="text-[#D4AF37] text-xs uppercase tracking-widest mb-1">{n.label}</h4>
                    <p className="wine-text text-sm leading-relaxed">{n.value}</p>
                  </div>
                ))}

                {details.pairings.length > 0 && (
                  <div>
                    <h4 className="text-[#D4AF37] text-xs uppercase tracking-widest mb-2 flex items-center gap-1.5">
                      <UtensilsCrossed className="w-3.5 h-3.5" /> Passer til
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      {details.pairings.map(p => (
                        <span key={p} className="px-2.5 py-1 rounded-full text-xs border border-[#722F37]/60 wine-text">
                          {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <a
                  href={details.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-[#D4AF37] hover:underline"
                >
                  Se vinen på vinmonopolet.no <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </>
            )}

            {!loading && !details && wine.productCode && (
              <p className="wine-text-subtle text-sm">Fikk ikke hentet mer info fra Vinmonopolet akkurat nå.</p>
            )}
            {!wine.productCode && (
              <p className="wine-text-subtle text-sm">Denne vinen er lagt inn manuelt, så det finnes ikke mer info.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
