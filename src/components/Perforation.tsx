// Skillelinje mellom seksjoner på forsiden – en rad av små prikker, som
// perforeringen på en ekte loddbok, i stedet for en vanlig kantlinje.
export default function Perforation() {
  return (
    <div aria-hidden="true" className="flex items-center justify-between py-8">
      {Array.from({ length: 48 }, (_, i) => (
        <span key={i} className="perf-dot h-1 w-1 shrink-0 rounded-full" />
      ))}
    </div>
  );
}
