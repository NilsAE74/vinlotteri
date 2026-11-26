import type { LeaderRow } from '@/lib/quiz';

// Ukens toppliste i quizen: plass, navn, klasse og poeng. Brukes på quizsiden
// (etter at man har svart) og på forsiden. `extra` er din egen rad når du
// ikke er blant de fem beste. Topp 3 får merket «+N lodd» når runden gir
// bonuslodd (fra 2027).
const seconds = (s: number) => s.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function QuizTopList({ rows, extra, compact = false }: { rows: LeaderRow[]; extra?: LeaderRow; compact?: boolean }) {
  const all = extra ? [...rows, extra] : rows;
  return (
    <table className={`w-full text-left ${compact ? 'text-[13.5px]' : 'text-[15px]'}`}>
      <caption className="sr-only">Ukens beste i quizen</caption>
      <thead className="sr-only">
        <tr>
          <th>Plass</th>
          <th>Navn</th>
          <th>Klasse</th>
          <th>Riktige</th>
        </tr>
      </thead>
      <tbody>
        {all.map((r, i) => (
          <tr
            key={`${r.rank}-${r.name}`}
            className={`border-t wine-border-faint ${r.me ? 'wine-accent' : 'wine-text'} ${extra && i === all.length - 1 ? 'border-dashed' : ''}`}
          >
            <td className="py-1.5 pr-2 w-7 font-mono wine-text-subtle tabular-nums">{r.rank}</td>
            <td className="py-1.5 pr-2 truncate max-w-0 w-full">
              {r.name}
              {r.bonus && (
                <span className="ml-1.5 font-mono text-[0.8em] wine-accent whitespace-nowrap" title={`${r.bonus} ekstra lodd i ukens trekning`}>
                  +{r.bonus} lodd
                </span>
              )}
            </td>
            <td className="py-1.5 pr-3 font-serif italic wine-text-muted whitespace-nowrap">{r.className}</td>
            <td className="py-1.5 font-mono tabular-nums text-right whitespace-nowrap" title={`${seconds(r.seconds)} sekunder`}>
              {r.score}/5
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
