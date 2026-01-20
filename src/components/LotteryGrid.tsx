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

export default function LotteryGrid({ tickets }: { tickets: Ticket[] }) {
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
              disabled={ticket.isTaken}
              onClick={() => toggleTicket(ticket.number)}
              className={twMerge(
                clsx(
                  // Fjernet aspect-square, bruker fast høyde (h-10 / h-12) for kompakt visning
                  "h-10 sm:h-12 relative flex flex-col items-center justify-center rounded border transition-all duration-200 overflow-hidden group",
                  
                  // AVAILABLE STATE
                  !ticket.isTaken && !isSelected && "bg-[#2a1216]/60 border-[#722F37]/30 hover:border-[#D4AF37] hover:bg-[#722F37]/20",
                  
                  // SELECTED STATE (Ny!)
                  isSelected && "bg-[#D4AF37] border-[#D4AF37] text-[#1a0b0e] scale-105 z-10 shadow-[0_0_10px_rgba(212,175,55,0.5)]",
                  
                  // TAKEN STATE
                  ticket.isTaken && !ticket.hasWon && "bg-[#111] border-[#333] opacity-40 cursor-not-allowed",
                  
                  // WINNER STATE
                  ticket.hasWon && "bg-gradient-to-br from-[#D4AF37] to-[#8a6e1f] border-[#D4AF37] shadow-[0_0_15px_rgba(212,175,55,0.4)] scale-110 z-20"
                )
              )}
            >
              {ticket.isTaken ? (
                 <span className="text-[9px] sm:text-[10px] text-gray-400 font-mono truncate w-full px-1 text-center">
                   {ticket.hasWon ? '🏆' : (() => {
                     const nameParts = ticket.ownerName?.split(' ') || [];
                     if (nameParts.length === 0) return '';
                     if (nameParts.length === 1) return nameParts[0];
                     return `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`;
                   })()}
                 </span>
              ) : (
                 <span className={clsx(
                   "text-sm font-serif font-bold",
                   isSelected ? "text-[#1a0b0e]" : "text-[#D4AF37]/80 group-hover:text-[#D4AF37]"
                 )}>
                   {ticket.number}
                 </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Flytende handlingslinje når lodd er valgt */}
      {selectedTickets.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 animate-in slide-in-from-bottom-4">
          <button
            onClick={() => setIsDialogOpen(true)}
            className="bg-[#D4AF37] text-[#1a0b0e] font-serif font-bold text-lg px-8 py-3 rounded-full shadow-2xl hover:scale-105 transition-transform flex items-center gap-2"
          >
            Kjøp {selectedTickets.length} lodd
            <span className="bg-[#1a0b0e]/10 px-2 py-0.5 rounded text-sm">
              (Nr: {selectedTickets.join(', ')})
            </span>
          </button>
        </div>
      )}

      <TicketDialog 
        ticketNumbers={selectedTickets}
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        onSuccess={() => setSelectedTickets([])} // Tømmer utvalget etter kjøp
      />
    </>
  );
}