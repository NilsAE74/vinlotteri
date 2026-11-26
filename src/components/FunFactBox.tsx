'use client';

import { useState } from 'react';
import { Lightbulb, Shuffle } from 'lucide-react';
import { pickFunFactIndex } from '@/lib/wine-fun-facts';

// Fun fact om vin på forsiden. Factene hentes fra databasen og første fact
// velges på serveren (så server- og klient-HTML er like); «Trekk en ny» trekker
// en annen tilfeldig fra listen.
export default function FunFactBox({ facts, initialIndex }: { facts: string[]; initialIndex: number }) {
  const [index, setIndex] = useState(initialIndex);
  const [drawn, setDrawn] = useState(false);

  return (
    <aside
      aria-label="Fun fact om vin"
      className="wine-card-alpha border border-dashed wine-border-strong rounded-lg px-4 pt-3.5 pb-2.5 flex gap-2.5 items-start"
    >
      <Lightbulb aria-hidden className="w-[18px] h-[18px] shrink-0 mt-0.5 wine-accent" />
      <div className="min-w-0 flex-1">
        {/* Ny key ved hver trekning, så inntoningen spilles av på nytt */}
        <p
          key={index}
          aria-live="polite"
          className={`wine-text text-[13.5px] leading-relaxed${drawn ? ' fact-in' : ''}`}
        >
          <span className="wine-text-muted">Visste du dette?</span> {facts[index]}
        </p>
        <button
          type="button"
          onClick={() => {
            setIndex(i => pickFunFactIndex(facts.length, i));
            setDrawn(true);
          }}
          className="wine-link mt-1.5 -ml-1 inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#D4AF37]"
        >
          <Shuffle aria-hidden className="w-3.5 h-3.5" />
          Trekk en ny
        </button>
      </div>
    </aside>
  );
}
