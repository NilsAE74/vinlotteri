import { formatDrawDate } from '@/lib/draw-date';

// Loddbok-stempelet med runde og trekningstidspunkt, brukt i headeren på
// forsiden og på trekningssiden.
export default function RoundStamp({ roundName }: { roundName: string }) {
  const drawDate = formatDrawDate(roundName);
  return (
    <div className="font-mono text-[13px] wine-text-muted border border-dashed wine-border-strong rounded-lg px-3.5 py-2">
      {roundName}, trekning {drawDate ?? 'fredag'} kl. 14.15
    </div>
  );
}
