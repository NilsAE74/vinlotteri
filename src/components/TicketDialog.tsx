'use client';

import { useState } from 'react';
import { bookTicket } from '@/lib/actions';
import { Loader2 } from 'lucide-react';

interface TicketDialogProps {
  ticketNumbers: number[]; // Endret fra ticketNumber til array
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;   // Ny callback for å tømme valgte lodd i griden
}

export default function TicketDialog({ ticketNumbers, isOpen, onClose, onSuccess }: TicketDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);
    
    // Send arrayet som en JSON-streng
    formData.append('numbers', JSON.stringify(ticketNumbers));

    const result = await bookTicket(formData);

    if (result.success) {
      onSuccess(); // Tøm valg og lukk
      onClose();
    } else {
      setError(result.message || "Noe gikk galt");
    }
    setIsPending(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1a0b0e] border border-[#722F37] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-[#722F37] p-4 text-center">
          <h2 className="text-xl font-serif text-[#D4AF37]">
            Kjøp {ticketNumbers.length} lodd
          </h2>
          <p className="text-xs text-[#D4AF37]/80 mt-1">
            Loddnr: {ticketNumbers.join(', ')}
          </p>
        </div>
        
        <form action={handleSubmit} className="p-6 space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Navn</label>
            <input
              name="name"
              id="name"
              type="text"
              required
              autoFocus
              placeholder="F.eks. Ola Nordmann"
              className="w-full bg-[#2a1216] border border-[#5a252c] rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37] transition-all"
            />
          </div>

          {error && (
            <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded border border-red-900/50">
              {error}
            </div>
          )}

          <div className="flex gap-3 justify-end mt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Avbryt
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-6 py-2 bg-[#D4AF37] text-[#1a0b0e] font-bold rounded-md hover:bg-[#b5952f] transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
              {isPending ? 'Kjøper...' : 'Bekreft Kjøp'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}