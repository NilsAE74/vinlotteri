'use client';

import { useEffect, useState, useTransition } from 'react';
import { ShoppingCart, RefreshCw, Shuffle, ExternalLink, Wine, Check, ChevronRight } from 'lucide-react';
import WineDialog from './WineDialog';
import { formatWine } from '@/lib/wine-format';
import {
  suggestWines,
  getVinmonopoletStores,
  addSuggestedWines,
  type VmpStore,
} from '@/lib/admin-actions';
import {
  CATEGORIES,
  CATEGORY_LABELS,
  swapWine,
  totalPrice,
  type Candidate,
  type Category,
  type Counts,
  type Pools,
} from '@/lib/wine-suggestions';

// Innstillingene huskes i nettleseren (kun bekvemmelighet, ikke viktig data)
const SETTINGS_KEY = 'wine-planner-settings';

type Settings = {
  budget: number;
  counts: Counts;
  storeId: string;
  includeSpecial: boolean;
  minPrice: number;
};

const DEFAULT_SETTINGS: Settings = {
  budget: 1000,
  counts: { rødvin: 2, hvitvin: 1 },
  storeId: '',
  includeSpecial: false,
  minPrice: 150,
};

function loadSettings(): Settings {
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function saveSettings(s: Settings) {
  try {
    window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
  } catch {
    // Ikke kritisk
  }
}

const kr = (n: number) => `${n.toLocaleString('nb-NO', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} kr`;

const inputClass =
  'wine-card-bg wine-text border border-[#722F37]/50 rounded-lg px-3 py-2 outline-none focus:border-[#D4AF37]';
const buttonClass =
  'px-4 py-2 bg-[#722F37] text-[#D4AF37] rounded-lg flex items-center justify-center gap-2 disabled:opacity-50';

export default function WineShoppingPlanner({ hasActiveRound }: { hasActiveRound: boolean }) {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [stores, setStores] = useState<VmpStore[]>([]);
  const [wines, setWines] = useState<Candidate[] | null>(null);
  const [pools, setPools] = useState<Pools>({});
  const [budgetUsed, setBudgetUsed] = useState(0); // Budsjettet forslaget ble laget for
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [added, setAdded] = useState(false);
  const [open, setOpen] = useState<Candidate | null>(null); // Vin som vises i detaljvinduet
  const [isSuggesting, startSuggest] = useTransition();
  const [isAdding, startAdd] = useTransition();

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- localStorage finnes bare i nettleseren
    setSettings(loadSettings());
    getVinmonopoletStores().then(setStores);
  }, []);

  function update(patch: Partial<Settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveSettings(next);
  }

  function setCount(c: Category, value: string) {
    const n = Math.max(0, Math.min(6, Math.floor(Number(value) || 0)));
    update({ counts: { ...settings.counts, [c]: n } });
  }

  function suggest() {
    setError('');
    setAdded(false);
    startSuggest(async () => {
      const res = await suggestWines({ ...settings, storeId: settings.storeId || null });
      if (!res.success) {
        setError(res.message);
        setWines(null);
        return;
      }
      setWines(res.wines);
      setPools(res.pools);
      setBudgetUsed(settings.budget);
      setNote(res.excludedCount > 0 ? `${res.excludedCount} viner dere har hatt før ble hoppet over.` : '');
    });
  }

  function swap(index: number) {
    if (!wines) return;
    const next = swapWine(wines, index, pools, budgetUsed);
    if (next) {
      setWines(next);
      setAdded(false);
    } else {
      setError('Fant ingen annen flaske i samme kategori som passer i budsjettet.');
    }
  }

  function useAsPrizes() {
    if (!wines) return;
    setError('');
    startAdd(async () => {
      const res = await addSuggestedWines(wines.map(w => w.code));
      if (res.success) setAdded(true);
      else setError(res.message ?? 'Noe gikk galt');
    });
  }

  const total = wines ? totalPrice(wines) : 0;
  const storeName = stores.find(s => s.id === settings.storeId)?.name;

  return (
    <div className="space-y-5">
      {/* Innstillinger */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <label className="col-span-2 sm:col-span-1 text-sm wine-text-muted space-y-1">
          <span>Budsjett (kr)</span>
          <input
            type="number"
            min={100}
            step={50}
            value={settings.budget}
            onChange={e => update({ budget: Number(e.target.value) })}
            className={`w-full ${inputClass}`}
          />
        </label>
        {CATEGORIES.map(c => (
          <label key={c} className="text-sm wine-text-muted space-y-1">
            <span>{CATEGORY_LABELS[c]}</span>
            <input
              type="number"
              min={0}
              max={6}
              value={settings.counts[c] ?? 0}
              onChange={e => setCount(c, e.target.value)}
              className={`w-full ${inputClass}`}
            />
          </label>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
        <label className="text-sm wine-text-muted space-y-1">
          <span>Butikk (kun viner på lager der)</span>
          <select
            value={settings.storeId}
            onChange={e => update({ storeId: e.target.value })}
            className={`w-full ${inputClass}`}
          >
            <option value="">Alle butikker</option>
            {stores.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="text-sm wine-text-muted space-y-1">
          <span>Minstepris per flaske</span>
          <input
            type="number"
            min={0}
            step={10}
            value={settings.minPrice}
            onChange={e => update({ minPrice: Number(e.target.value) })}
            className={`w-full sm:w-36 ${inputClass}`}
          />
        </label>
      </div>

      <div className="space-y-2 text-sm wine-text-muted">
        <p>
          Forslagene hentes fra Vinmonopolets basisutvalg.
          <span className="wine-text-subtle"> Viner som må selge jevnt for å bli i hyllene.</span>
        </p>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.includeSpecial}
            onChange={e => update({ includeSpecial: e.target.checked })}
            className="mt-1 accent-[#722F37]"
          />
          <span>
            Ta med spesialutvalget også
            <span className="wine-text-subtle"> (finnes mest i de største butikkene)</span>
          </span>
        </label>
      </div>

      <button type="button" onClick={suggest} disabled={isSuggesting} className={`w-full ${buttonClass} py-3 font-bold`}>
        <RefreshCw className={`w-4 h-4 ${isSuggesting ? 'animate-spin' : ''}`} />
        {isSuggesting ? 'Leter i hyllene…' : wines ? 'Nytt forslag' : 'Lag forslag'}
      </button>

      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* Handlelisten */}
      {wines && (
        <div className="space-y-3 pt-4 border-t border-[#722F37]/30">
          {storeName && <p className="text-sm wine-text-muted">Alle flaskene var på lager på {storeName} da forslaget ble laget.</p>}
          <ul className="space-y-3">
            {wines.map((w, i) => (
              <li key={w.code} className="flex gap-3 items-center wine-border-faint border-b pb-3 last:border-0">
                <button
                  type="button"
                  onClick={() => setOpen(w)}
                  title="Trykk for mer info"
                  className="group min-w-0 flex-1 flex gap-3 items-center text-left rounded-lg -m-1 p-1 hover:bg-[#722F37]/10 transition-colors"
                >
                  {w.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={w.imageUrl} alt="" className="w-14 h-14 object-contain shrink-0 transition-transform group-hover:scale-110" />
                  ) : (
                    <Wine className="w-14 h-14 p-3 text-[#722F37] shrink-0" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-xs uppercase tracking-wider text-[#D4AF37]">{CATEGORY_LABELS[w.category]}</div>
                    <div className="wine-text font-semibold group-hover:text-[#D4AF37] transition-colors">{w.name}</div>
                    <div className="wine-text-subtle text-xs">
                      {[w.country, w.district, w.selection].filter(Boolean).join(' · ')}
                    </div>
                    <div className="text-sm wine-text-muted mt-1">
                      Varenr. <span className="font-mono wine-text">{w.code}</span> · {kr(w.priceValue)}
                    </div>
                  </div>
                  <ChevronRight aria-hidden className="w-4 h-4 shrink-0 text-[#D4AF37]/50 group-hover:text-[#D4AF37] transition-colors" />
                </button>
                <div className="flex flex-col gap-1 shrink-0">
                  <button
                    type="button"
                    title="Bytt flaske"
                    onClick={() => swap(i)}
                    className="p-2 wine-text-subtle hover:text-[#D4AF37]"
                  >
                    <Shuffle className="w-4 h-4" />
                  </button>
                  {w.url && (
                    <a href={w.url} target="_blank" rel="noreferrer" title="Åpne hos Vinmonopolet" className="p-2 wine-text-subtle hover:text-[#D4AF37]">
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <div className="flex justify-between text-sm">
            <span className="wine-text-muted">Totalt</span>
            <span className="wine-text font-bold">
              {kr(total)} <span className="wine-text-subtle font-normal">({kr(budgetUsed - total)} igjen)</span>
            </span>
          </div>
          {note && <p className="text-xs wine-text-subtle">{note}</p>}
          {open && (
            <WineDialog
              wine={{ info: formatWine(open), imageUrl: open.imageUrl, productCode: open.code }}
              onClose={() => setOpen(null)}
            />
          )}

          {added ? (
            <p className="text-sm text-green-500 flex items-center gap-2">
              <Check className="w-4 h-4" /> Lagt til som ukens premier.
            </p>
          ) : (
            <button
              type="button"
              onClick={useAsPrizes}
              disabled={isAdding || !hasActiveRound}
              className={`w-full ${buttonClass} py-3`}
            >
              <ShoppingCart className="w-4 h-4" />
              {isAdding ? 'Legger til…' : hasActiveRound ? 'Bruk som ukens premier' : 'Start en runde for å legge til'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
