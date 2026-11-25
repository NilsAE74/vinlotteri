import { Lightbulb } from 'lucide-react';

// Fun fact om vin på forsiden. Faktaen velges på serveren (pickFunFact),
// så det kommer en ny hver gang siden lastes.
export default function FunFactBox({ fact }: { fact: string }) {
  return (
    <aside
      aria-label="Fun fact om vin"
      className="mt-6 wine-card-alpha border border-dashed wine-border-strong rounded-lg px-4 py-3.5 flex gap-2.5 items-start"
    >
      <Lightbulb aria-hidden className="w-[18px] h-[18px] shrink-0 mt-0.5 wine-accent" />
      <p className="wine-text text-[13.5px] leading-relaxed">
        <span className="wine-text-muted">Visste du dette?</span> {fact}
      </p>
    </aside>
  );
}
