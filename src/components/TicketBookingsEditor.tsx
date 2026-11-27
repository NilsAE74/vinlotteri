'use client';

import { useState, useTransition } from 'react';
import { Trash2, X } from 'lucide-react';
import { releaseTickets } from '@/lib/admin-actions';

type BookedTicket = {
  id: number;
  number: number;
  ownerName: string | null;
  hasWon: boolean;
  isBonus: boolean; // Gratis bonuslodd fra quizen, ikke betalt
};

export default function TicketBookingsEditor({ tickets }: { tickets: BookedTicket[] }) {
  const [filter, setFilter] = useState('');

  // Grupper solgte lodd per navn
  const groups = new Map<string, BookedTicket[]>();
  for (const t of tickets) {
    const name = t.ownerName ?? '(uten navn)';
    groups.set(name, [...(groups.get(name) ?? []), t]);
  }

  const q = filter.trim().toLowerCase();
  const rows = [...groups.entries()]
    .filter(([name, list]) =>
      !q || name.toLowerCase().includes(q) || list.some(t => String(t.number) === q)
    )
    .sort(([a], [b]) => a.localeCompare(b, 'nb'));

  if (tickets.length === 0) {
    return <p className="wine-text-subtle text-sm">Ingen lodd er solgt ennå.</p>;
  }

  return (
    <div className="space-y-4">
      <input
        value={filter}
        onChange={e => setFilter(e.target.value)}
        placeholder="Søk på navn eller loddnummer"
        className="w-full wine-card-bg wine-text border border-[#722F37]/50 rounded-lg px-3 py-2 outline-none focus:border-[#D4AF37]"
      />
      <ul className="space-y-3">
        {rows.map(([name, list]) => (
          <OwnerRow key={name} name={name} tickets={list.sort((a, b) => a.number - b.number)} />
        ))}
        {rows.length === 0 && <p className="wine-text-subtle text-sm">Ingen treff.</p>}
      </ul>
      <p className="text-xs wine-text-subtle">
        Klikk på loddene du vil frigi, og bekreft. Lodd som har vunnet kan ikke frigis.
        Lodd med stiplet kant er gratis bonuslodd fra quizen og skal ikke betales.
      </p>
    </div>
  );
}

function OwnerRow({ name, tickets }: { name: string; tickets: BookedTicket[] }) {
  const [selected, setSelected] = useState<number[]>([]);
  const [isPending, startTransition] = useTransition();
  const releasable = tickets.filter(t => !t.hasWon);
  const allSelected = releasable.length > 0 && selected.length === releasable.length;
  const bonus = tickets.filter(t => t.isBonus).length;

  const toggle = (id: number) =>
    setSelected(prev => (prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]));

  const release = () =>
    startTransition(async () => {
      await releaseTickets(selected);
      setSelected([]);
    });

  const selectedNumbers = tickets
    .filter(t => selected.includes(t.id))
    .map(t => t.number)
    .join(', ');

  return (
    <li className="wine-border-faint border-b pb-3 last:border-0">
      <div className="flex justify-between items-center gap-2 mb-2">
        <div className="font-bold wine-text">
          {name}{' '}
          <span className="wine-text-subtle font-normal text-sm">
            ({tickets.length - bonus}
            {bonus > 0 && ` + ${bonus} bonus`})
          </span>
        </div>
        {releasable.length > 1 && (
          <button
            onClick={() => setSelected(allSelected ? [] : releasable.map(t => t.id))}
            disabled={isPending}
            className="text-xs wine-text-muted hover:text-[#D4AF37] flex items-center gap-1"
          >
            {allSelected ? 'Fjern valg' : 'Velg alle'}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        {tickets.map(t => (
          <button
            key={t.id}
            disabled={t.hasWon || isPending}
            onClick={() => toggle(t.id)}
            aria-pressed={selected.includes(t.id)}
            title={`${t.isBonus ? 'Bonuslodd fra quizen. ' : ''}${t.hasWon ? 'Har vunnet' : selected.includes(t.id) ? 'Fjern fra valget' : 'Velg for frigiving'}`}
            className={`font-mono text-sm px-2 py-1 rounded border transition-colors ${t.isBonus ? 'border-dashed ' : ''}${
              t.hasWon
                ? 'border-[#D4AF37] text-[#D4AF37] cursor-not-allowed'
                : selected.includes(t.id)
                  ? 'border-red-500 bg-red-900/40 text-red-500 line-through'
                  : 'border-[#722F37]/50 wine-text hover:border-red-500 hover:text-red-500'
            }`}
          >
            {t.number}
          </button>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <span className="wine-text-muted">
            Frigi {selected.length === 1 ? 'lodd' : `${selected.length} lodd`} {selectedNumbers}?
          </span>
          <button
            onClick={release}
            disabled={isPending}
            className="px-3 py-1 rounded bg-red-900/40 border border-red-800 text-red-500 hover:bg-red-900/60 disabled:opacity-50 flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" /> {isPending ? 'Frigir…' : 'Ja, frigi'}
          </button>
          <button
            onClick={() => setSelected([])}
            disabled={isPending}
            className="px-3 py-1 rounded wine-text-muted hover:text-[#D4AF37] flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Avbryt
          </button>
        </div>
      )}
    </li>
  );
}
