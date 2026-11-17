'use client';

import { useState, useTransition } from 'react';
import { FlaskConical, Eraser } from 'lucide-react';
import { generateTestTickets, removeTestTickets } from '@/lib/admin-actions';

// Testverktøy (kun i utviklingsmodus): fyll 100 ledige lodd med testnavn, eller fjern dem igjen
export default function TestTicketsButtons() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const run = (action: () => Promise<{ success: boolean; message?: string; count?: number; names?: number }>, done: (r: { count?: number; names?: number }) => string) =>
    startTransition(async () => {
      setMessage(null);
      const r = await action();
      setMessage(r.success ? done(r) : r.message ?? 'Noe gikk galt.');
    });

  const button =
    'flex-1 py-3 flex items-center justify-center gap-2 rounded-lg font-bold border transition-all disabled:opacity-40 disabled:cursor-wait';

  return (
    <div>
      <div className="flex gap-2">
        <button
          onClick={() => run(() => generateTestTickets(100), r => `${r.count} testlodd laget på ${r.names} navn.`)}
          disabled={isPending}
          className={`${button} border-sky-700/60 text-sky-500 hover:bg-sky-900/20`}
        >
          <FlaskConical className="w-4 h-4" /> Lag 100 testlodd
        </button>
        <button
          onClick={() => run(removeTestTickets, r => `${r.count} testlodd fjernet.`)}
          disabled={isPending}
          className={`${button} border-sky-700/40 wine-text-muted hover:text-sky-500`}
        >
          <Eraser className="w-4 h-4" /> Fjern testlodd
        </button>
      </div>
      <p className="text-xs wine-text-subtle mt-2 text-center">
        {isPending
          ? 'Jobber…'
          : message ?? 'Kun i utviklingsmodus. Fyller tilfeldige ledige lodd – lodd som er tatt blir ikke rørt.'}
      </p>
    </div>
  );
}
