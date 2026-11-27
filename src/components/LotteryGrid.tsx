'use client';

import { useState } from 'react';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import TicketDialog from './TicketDialog';

type Ticket = {
  id: number;
  number: number;
  ownerName: string | null;
  isTaken: boolean;
  hasWon: boolean;
};

// locked: salget er stengt, ingen lodd kan velges (bookTicket avviser uansett)
export default function LotteryGrid({ tickets, nameSuggestions = [], locked = false }: { tickets: Ticket[]; nameSuggestions?: string[]; locked?: boolean }) {
  // Endret fra single number til array
  const [selectedTickets, setSelectedTickets] = useState<number[]>([]);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  const toggleTicket = (number: number) => {
    setSelectedTickets(prev => 
      prev.includes(number) 
        ? prev.filter(n => n !== number) 
        : [...prev, number]
    );
  };

  return (
    <>
      {/* Endret grid-cols for å gjøre dem mindre (20 per rad på desktop) */}
      <div className="grid grid-cols-10 md:grid-cols-20 gap-1.5 max-w-7xl mx-auto p-2">
        {tickets.map((ticket) => {
          const isSelected = selectedTickets.includes(ticket.number);
          
          return (
            <button
              key={ticket.id}
              disabled={locked || ticket.isTaken}
              onClick={() => toggleTicket(ticket.number)}
              className={twMerge(
                clsx(
                  // Fjernet aspect-square, bruker fast høyde (h-10 / h-12) for kompakt visning
                  "h-10 sm:h-12 relative flex flex-col items-center justify-center rounded border font-mono transition-all duration-200 overflow-hidden",

                  // AVAILABLE STATE
                  !ticket.isTaken && !isSelected && !locked && "ticket-available",

                  // LOCKED (ledig, men salget er stengt)
                  !ticket.isTaken && locked && "ticket-taken opacity-40 cursor-not-allowed",

                  // SELECTED STATE
                  isSelected && "ticket-result scale-105 z-10",

                  // TAKEN STATE
                  ticket.isTaken && !ticket.hasWon && "ticket-taken opacity-60 cursor-not-allowed",

                  // WINNER STATE
                  ticket.hasWon && "ticket-result scale-110 z-20 font-semibold"
                )
              )}
            >
              {ticket.isTaken ? (
                 <span className={clsx("text-[9px] sm:text-[10px] truncate w-full px-1 text-center", !ticket.hasWon && "wine-text-subtle")}>
                   {ticket.hasWon ? '★' : (() => {
                     const nameParts = ticket.ownerName?.split(' ') || [];
                     if (nameParts.length === 0) return '';
                     if (nameParts.length === 1) return nameParts[0];
                     return `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`;
                   })()}
                 </span>
              ) : (
                 <span className={clsx("text-sm", isSelected ? "" : "wine-text-muted")}>
                   {ticket.number}
                 </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Flytende handlingslinje når lodd er valgt */}
      {selectedTickets.length > 0 && !locked && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4">
          <button
            onClick={() => setIsDialogOpen(true)}
            className="wine-accent-bg font-medium text-lg px-8 py-3 rounded-full shadow-2xl hover:scale-105 transition-transform flex items-center gap-2"
            style={{ color: 'var(--wine-ink)' }}
          >
            Kjøp {selectedTickets.length} lodd
            <span className="bg-black/10 px-2 py-0.5 rounded text-sm font-mono">
              {selectedTickets.join(', ')}
            </span>
          </button>
        </div>
      )}

      <TicketDialog 
        ticketNumbers={selectedTickets}
        nameSuggestions={nameSuggestions}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => setSelectedTickets([])} // Tømmer utvalget etter kjøp
      />
    </>
  );
}