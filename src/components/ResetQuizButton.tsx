'use client';

import { useState, useTransition } from 'react';
import { RotateCcw } from 'lucide-react';
import { resetQuiz } from '@/lib/admin-actions';

// Sletter alle quizforsøk i den aktive runden (kun i utviklingsmodus), så quizen kan testes på nytt
export default function ResetQuizButton({ attemptCount }: { attemptCount: number }) {
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () =>
    startTransition(async () => {
      const result = await resetQuiz();
      setConfirming(false);
      setMessage(result.success ? `Quizen er nullstilt (${result.count} forsøk slettet).` : result.message ?? 'Noe gikk galt.');
    });

  return (
    <div>
      {!confirming ? (
        <button
          onClick={() => { setConfirming(true); setMessage(null); }}
          disabled={attemptCount === 0}
          className="w-full py-3 flex items-center justify-center gap-2 rounded-lg font-bold border border-sky-700/60 text-sky-500 hover:bg-sky-900/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RotateCcw className="w-4 h-4" /> Nullstill quiz
          <span className="font-normal text-sm">({attemptCount} forsøk)</span>
        </button>
      ) : (
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 py-2 text-sm">
          <span className="wine-text-muted">Slette alle {attemptCount} quizforsøk i runden? Det kan ikke angres.</span>
          <div className="flex gap-2">
            <button
              onClick={reset}
              disabled={isPending}
              className="px-3 py-1.5 rounded bg-sky-900/30 border border-sky-600 text-sky-400 hover:bg-sky-900/50 disabled:opacity-50"
            >
              {isPending ? 'Sletter…' : 'Ja, slett'}
            </button>
            <button
              onClick={() => setConfirming(false)}
              disabled={isPending}
              className="px-3 py-1.5 rounded wine-text-muted hover:text-sky-400"
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
