'use client';

type Props = {
  taken: number;
  total: number;
};

// Tersklene passer til vanlig salg (ca. 100–130 av 200), så meldingene skifter
// der salget faktisk er. Med 200 lodd: 20, 50, 90, 120, 160 og 190 solgt.
function getMotivation(pct: number, remaining: number): string {
  if (pct === 0) return 'Vær den første! Sikre deg et lodd nå.';
  if (pct < 0.1) return 'Salget er i gang – velg ditt lykketall!';
  if (pct < 0.25) return 'Loddene fyller seg opp. Gode tall er fortsatt ledige.';
  if (pct < 0.45) return 'Godt i gang! Hvert lodd er en sjanse på ukens viner.';
  if (pct < 0.6) return 'Rundt halvveis – mange har allerede kjøpt.';
  if (pct < 0.8) return 'Det går unna! Bli med før trekningen.';
  if (pct < 0.95) return `Bare ${remaining} lodd igjen!`;
  if (remaining > 0) return remaining === 1 ? 'Siste lodd – ta det nå!' : `Siste ${remaining} lodd – ta et nå!`;
  return 'Alle lodd er solgt. Lykke til med trekningen!';
}

export default function TicketProgressBar({ taken, total }: Props) {
  const pct = total > 0 ? taken / total : 0;
  const barPct = Math.round(pct * 100);
  const remaining = total - taken;

  return (
    <div>
      {/* Label row */}
      <div className="flex justify-between items-baseline mb-2 text-sm flex-wrap gap-1.5">
        <span className="wine-text-muted">
          <span className="wine-accent font-semibold">{taken}</span> av {total} lodd solgt
        </span>
        <span className="wine-text-subtle text-xs">
          {remaining > 0 ? `${remaining} ledige` : 'Utsolgt'}
        </span>
      </div>

      {/* Bar track */}
      <div className="relative h-2.5 rounded-md overflow-hidden wine-card-bg border wine-border-faint">
        <div
          className="h-full rounded-md wine-accent-bg transition-all duration-700 ease-out motion-reduce:transition-none"
          style={{ width: `${barPct}%` }}
        />
      </div>

      {/* Motivation text */}
      <p className="text-xs wine-text-muted mt-2 italic">
        {getMotivation(pct, remaining)}
      </p>
    </div>
  );
}
