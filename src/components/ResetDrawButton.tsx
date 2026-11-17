'use client';

import { useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { resetDraw } from '@/lib/admin-actions';

// Nullstiller trekningen (fjerner vinnere) uten å røre solgte lodd. Nyttig for testing.
export default function ResetDrawButton({ winnerCount }: { winnerCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () =>
    startTransition(async () => {
      const result = await resetDraw();
      setConfirming(false);
      setMessage(result.success ? `Trekningen er nullstilt (${result.count} vinnere fjernet).` : result.message ?? 'Noe gikk galt.');
    });

  return (
    <div>
      {!confirming ? (
        <button
          onClick={() => { setConfirming(true); setMessage(null); }}
          disabled={winnerCount === 0}
          className="w-full py-3 flex items-center justify-center gap-2 rounded-lg font-bold border border-[#D4AF37]/50 text-[#D4AF37] hover:bg-[#D4AF37]/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-4 h-4" /> Nullstill trekning
          {winnerCount > 0 && <span className="font-normal text-sm">({winnerCount} vinnere)</span>}
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 py-2 text-sm">
          <span className="wine-text-muted">Fjerne alle {winnerCount} vinnere? Solgte lodd beholdes.</span>
          <div className="flex gap-2">
            <button
              onClick={reset}
              disabled={isPending}
              className="px-3 py-1.5 rounded bg-[#D4AF37]/20 border border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/30 disabled:opacity-50"
            >
              {isPending ? 'Nullstiller…' : 'Ja, nullstill'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="px-3 py-1.5 rounded wine-text-muted hover:text-[#D4AF37]"
            >
              Avbryt
            </button>
          </div>
        </div>
      )}
      {message && <p className="text-xs wine-text-subtle mt-2 text-center">{message}</p>}
    </div>
  );
}
