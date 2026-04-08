'use client';

type Props = {
  taken: number;
  total: number;
};

function getMotivation(pct: number): string {
  if (pct === 0) return 'Vær den første! Sikre deg et lodd nå.';
  if (pct < 0.1) return 'Akkurat startet — velg ditt lykketall!';
  if (pct < 0.25) return 'Loddene fyller seg opp. Ikke vent for lenge!';
  if (pct < 0.5) return 'Godt i gang! Mange gode tall er fortsatt ledige.';
  if (pct < 0.65) return 'Over halvveis solgt — skynd deg!';
  if (pct < 0.8) return 'Det går unna! Få tak i et lodd mens du kan.';
  if (pct < 0.9) return 'Nesten fullt! Kun noen få lodd igjen.';
  if (pct < 1) return 'Siste sjanse — ta deg et lodd nå!';
  return 'Alle lodd er solgt. Lykke til med trekningen!';
}

export default function TicketProgressBar({ taken, total }: Props) {
  const pct = total > 0 ? taken / total : 0;
  const barPct = Math.round(pct * 100);
  const remaining = total - taken;

  return (
    <div className="max-w-2xl mx-auto px-2">
      {/* Label row */}
      <div className="flex justify-between items-baseline mb-1.5 text-sm">
        <span className="wine-text-muted">
          <span className="text-[#D4AF37] font-semibold">{taken}</span> av {total} lodd solgt
        </span>
        <span className="wine-text-subtle text-xs">
          {remaining > 0 ? `${remaining} ledige` : 'Utsolgt'}
        </span>
      </div>

      {/* Bar track */}
      <div className="relative h-3 rounded-full overflow-hidden wine-card-bg border wine-border-faint">
        <div
          className="h-full rounded-full transition-all duration-700 ease-out"
          style={{
            width: `${barPct}%`,
            background: 'linear-gradient(90deg, #722F37 0%, #D4AF37 100%)',
            boxShadow: barPct > 0 ? '0 0 8px rgba(212,175,55,0.4)' : 'none',
          }}
        />
      </div>

      {/* Motivation text */}
      <p className="text-center text-xs wine-text-muted mt-2 italic">
        {getMotivation(pct)}
      </p>
    </div>
  );
}
