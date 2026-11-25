import { Sparkles } from 'lucide-react';

// AI-oppsummering av ukens viner (generert i lib/ai-comment.ts). Står under
// fun fact-boksen på forsiden, i samme stiplede boks-stil.
export default function WineSummaryBox({ summary }: { summary: string }) {
  return (
    <p className="wine-card-alpha border border-dashed wine-border-strong rounded-lg px-4 py-3.5 flex gap-2.5 items-start wine-text-muted text-[13px] italic leading-relaxed">
      <Sparkles aria-hidden className="w-4 h-4 shrink-0 mt-0.5 wine-accent not-italic" />
      <span>{summary}</span>
    </p>
  );
}
