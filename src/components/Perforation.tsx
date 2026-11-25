// Skillelinje mellom seksjoner på forsiden – en tynn linje med utstansede
// hull, som rivelinjen i en ekte loddbok, i stedet for en vanlig kantlinje.
export default function Perforation() {
  return (
    <div aria-hidden="true" className="relative h-6 my-2">
      <div className="perf-line absolute inset-x-0 top-1/2 h-px -translate-y-1/2" />
      <div className="relative flex h-full items-center justify-between">
        {Array.from({ length: 40 }, (_, i) => (
          <span key={i} className="perf-hole h-1.5 w-1.5 shrink-0 rounded-full" />
        ))}
      </div>
    </div>
  );
}
