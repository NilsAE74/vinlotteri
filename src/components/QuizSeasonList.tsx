import type { SeasonRow } from '@/lib/quiz-season';

// Sammenlagtlisten i quizen for en sesong: plass, navn, antall quizer og
// riktige svar til sammen. Ved likt antall riktige vinner den med lavest
// samlet svartid (vises i tooltip). `me` uthever spillerens egen rad.
const seconds = (s: number) => s.toLocaleString('nb-NO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

export default function QuizSeasonList({ rows, me }: { rows: SeasonRow[]; me?: string }) {
  return (
    <table className="w-full text-left text-[15px]">
      <caption className="sr-only">Sammenlagt i quizen</caption>
      <thead className="text-xs wine-text-subtle font-mono">
        <tr>
          <th className="pb-1.5 pr-2 font-normal w-7">#</th>
          <th className="pb-1.5 pr-2 font-normal">Navn</th>
          <th className="pb-1.5 pr-3 font-normal text-right whitespace-nowrap">Quizer</th>
          <th className="pb-1.5 font-normal text-right whitespace-nowrap">Riktige</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(r => (
          <tr key={r.name} className={`border-t wine-border-faint ${r.name === me ? 'wine-accent' : 'wine-text'}`}>
            <td className="py-1.5 pr-2 font-mono wine-text-subtle tabular-nums">{r.rank}</td>
            <td className="py-1.5 pr-2 truncate max-w-0 w-full">{r.name}</td>
            <td className="py-1.5 pr-3 font-mono tabular-nums text-right wine-text-muted">{r.quizzes}</td>
            <td className="py-1.5 font-mono tabular-nums text-right" title={`${seconds(r.seconds)} sekunder til sammen`}>
              {r.score}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
