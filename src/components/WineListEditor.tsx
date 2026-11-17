'use client';

import { useState, useTransition } from 'react';
import { Search, Wine, Plus, Trash2, Check } from 'lucide-react';
import {
  searchVinmonopolet,
  addWine,
  updateWine,
  deleteWine,
  type WineSearchResult,
} from '@/lib/admin-actions';

type WineItem = {
  id: number;
  info: string;
  imageUrl: string | null;
};

// Lager en lesbar tekst av et søketreff, f.eks. "Barolo 2019 – Italia, Piemonte – 75 cl · 14% · Kr 699,90"
function formatWine(w: WineSearchResult) {
  const origin = [w.country, w.district].filter(Boolean).join(', ');
  const details = [w.volume, w.alcohol, w.price].filter(Boolean).join(' · ');
  return [w.name, origin, details].filter(Boolean).join(' – ');
}

const inputClass =
  'wine-card-bg wine-text border border-[#722F37]/50 rounded-lg px-3 py-2 outline-none focus:border-[#D4AF37]';
const buttonClass =
  'px-4 py-2 bg-[#722F37] text-[#D4AF37] rounded-lg flex items-center gap-2 disabled:opacity-50';

export default function WineListEditor({ wines }: { wines: WineItem[] }) {
  return (
    <div className="space-y-6">
      {wines.length > 0 ? (
        <ol className="space-y-3">
          {wines.map((wine, i) => (
            <WineRow key={wine.id} wine={wine} index={i} />
          ))}
        </ol>
      ) : (
        <p className="wine-text-subtle text-sm">Ingen flasker lagt til ennå.</p>
      )}

      <AddWine />
    </div>
  );
}

// En flaske i listen: kan redigeres og slettes
function WineRow({ wine, index }: { wine: WineItem; index: number }) {
  const [info, setInfo] = useState(wine.info);
  const [isPending, startTransition] = useTransition();
  const isDirty = info.trim() !== wine.info;

  return (
    <li className="flex gap-3 items-start wine-border-faint border-b pb-3 last:border-0">
      <div className="text-[#D4AF37] font-mono text-sm pt-2 w-6 shrink-0">{index + 1}.</div>
      {wine.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={wine.imageUrl} alt="" className="w-12 h-12 object-contain shrink-0" />
      ) : (
        <Wine className="w-12 h-12 p-3 text-[#722F37] shrink-0" />
      )}
      <textarea
        value={info}
        onChange={e => setInfo(e.target.value)}
        rows={2}
        className={`flex-1 min-w-0 text-sm ${inputClass}`}
      />
      <div className="flex flex-col gap-1 shrink-0">
        {isDirty && (
          <button
            type="button"
            title="Lagre endring"
            disabled={isPending}
            onClick={() => startTransition(async () => { await updateWine(wine.id, info); })}
            className="p-1 text-green-500 hover:text-green-400 disabled:opacity-50"
          >
            <Check className="w-4 h-4" />
          </button>
        )}
        <button
          type="button"
          title="Fjern"
          disabled={isPending}
          onClick={() => startTransition(async () => { await deleteWine(wine.id); })}
          className="p-1 wine-text-subtle hover:text-red-500 disabled:opacity-30"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </li>
  );
}

// Søk på Vinmonopolet og legg til treff, eller skriv inn manuelt
function AddWine() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<WineSearchResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [manual, setManual] = useState('');
  const [status, setStatus] = useState('');
  const [isSearching, startSearch] = useTransition();
  const [isAdding, startAdd] = useTransition();

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    startSearch(async () => {
      setResults(await searchVinmonopolet(query));
      setSearched(true);
    });
  }

  function add(info: string, imageUrl: string | null, productCode: string | null = null) {
    startAdd(async () => {
      const res = await addWine(info, imageUrl, productCode);
      setStatus(res.success ? '' : res.message ?? 'Noe gikk galt');
      if (res.success) {
        setResults([]);
        setSearched(false);
        setQuery('');
        setManual('');
      }
    });
  }

  return (
    <div className="space-y-3 pt-4 border-t border-[#722F37]/30">
      <form onSubmit={handleSearch} className="flex gap-2">
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Søk på Vinmonopolet, f.eks. «fontanafredda barolo»"
          className={`flex-1 min-w-0 ${inputClass}`}
        />
        <button type="submit" disabled={isSearching || query.trim().length < 2} className={buttonClass}>
          <Search className="w-4 h-4" /> {isSearching ? 'Søker…' : 'Søk'}
        </button>
      </form>

      {results.length > 0 && (
        <ul className="max-h-72 overflow-y-auto border border-[#722F37]/30 rounded-lg">
          {results.map(w => (
            <li key={w.code}>
              <button
                type="button"
                disabled={isAdding}
                onClick={() => add(formatWine(w), w.imageUrl, w.code)}
                className="w-full flex items-center gap-3 p-2 text-left hover:bg-[#722F37]/20 wine-border-faint border-b disabled:opacity-50"
              >
                {w.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.imageUrl} alt="" className="w-10 h-10 object-contain" />
                ) : (
                  <Wine className="w-10 h-10 p-2 text-[#722F37]" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="wine-text text-sm font-semibold truncate">{w.name}</div>
                  <div className="wine-text-subtle text-xs">
                    {[w.country, w.district, w.price].filter(Boolean).join(' · ')}
                  </div>
                </div>
                <Plus className="w-4 h-4 text-[#D4AF37] shrink-0" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {searched && results.length === 0 && !isSearching && (
        <p className="wine-text-subtle text-sm">Ingen treff. Skriv inn infoen selv under.</p>
      )}

      <form
        onSubmit={e => { e.preventDefault(); add(manual, null); }}
        className="flex gap-2"
      >
        <input
          value={manual}
          onChange={e => setManual(e.target.value)}
          placeholder="…eller skriv inn flasken manuelt"
          className={`flex-1 min-w-0 ${inputClass}`}
        />
        <button type="submit" disabled={isAdding || !manual.trim()} className={buttonClass}>
          <Plus className="w-4 h-4" /> Legg til
        </button>
      </form>
      {status && <p className="text-sm text-red-500">{status}</p>}
    </div>
  );
}
