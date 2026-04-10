'use client';
import { useState, useEffect } from 'react';

function getFridayOfISOWeek(week: number, year: number): Date {
  // Jan 4 is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // 1=Mon … 7=Sun
  const monday1 = new Date(jan4);
  monday1.setDate(jan4.getDate() - dayOfWeek + 1);
  const monday = new Date(monday1);
  monday.setDate(monday1.getDate() + (week - 1) * 7);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(14, 15, 0, 0);
  return friday;
}

type TimeLeft = { days: number; hours: number; minutes: number; seconds: number };

export default function CountdownTimer({ roundName }: { roundName: string }) {
  const [timeLeft, setTimeLeft] = useState<TimeLeft | null>(null);
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    const match = roundName.match(/Uke (\d+),\s*(\d{4})/);
    if (!match) return;

    const drawTime = getFridayOfISOWeek(parseInt(match[1]), parseInt(match[2]));

    const update = () => {
      const diff = drawTime.getTime() - Date.now();
      if (diff <= 0) {
        setIsPast(true);
        setTimeLeft(null);
        return;
      }
      setTimeLeft({
        days:    Math.floor(diff / 86_400_000),
        hours:   Math.floor((diff % 86_400_000) / 3_600_000),
        minutes: Math.floor((diff % 3_600_000)  / 60_000),
        seconds: Math.floor((diff % 60_000)      / 1_000),
      });
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [roundName]);

  if (isPast) {
    return (
      <p className="text-center text-[#D4AF37] text-sm uppercase tracking-widest">
        Tid for trekning
      </p>
    );
  }

  if (!timeLeft) return null;

  const units = [
    { value: timeLeft.days,    label: 'Dager' },
    { value: timeLeft.hours,   label: 'Timer' },
    { value: timeLeft.minutes, label: 'Min' },
    { value: timeLeft.seconds, label: 'Sek' },
  ];

  return (
    <div className="text-center">
      <p className="wine-text-muted text-xs uppercase tracking-widest mb-3">Trekning om</p>
      <div className="flex justify-center gap-3">
        {units.map(({ value, label }) => (
          <div key={label} className="wine-card-bg border border-[#722F37]/40 rounded-lg px-4 py-3 min-w-[62px]">
            <div className="text-2xl font-mono font-bold text-[#D4AF37] tabular-nums">
              {String(value).padStart(2, '0')}
            </div>
            <div className="text-xs wine-text-subtle uppercase tracking-wider mt-1">{label}</div>
          </div>
        ))}
      </div>
      <p className="wine-text-subtle text-xs mt-3">Fredag kl. 14:15</p>
    </div>
  );
}
