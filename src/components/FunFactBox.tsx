import { Lightbulb } from 'lucide-react';

// Fun fact om vin på forsiden. Faktaen velges på serveren (pickFunFact),
// så det kommer en ny hver gang siden lastes.
export default function FunFactBox({ fact }: { fact: string }) {
  return (
    <aside
      aria-label="Fun fact om vin"
      className="max-w-2xl mx-auto mb-5 wine-card-alpha border border-[#D4AF37]/30 rounded-lg px-4 py-3 flex gap-3 items-start"
    >
      <Lightbulb aria-hidden className="w-5 h-5 shrink-0 mt-0.5 text-[#D4AF37]" />
      <div>
        <p className="text-[#D4AF37] text-xs uppercase tracking-widest mb-1">Fun fact om vin</p>
        <p className="wine-text text-sm leading-relaxed">{fact}</p>
      </div>
    </aside>
  );
}
