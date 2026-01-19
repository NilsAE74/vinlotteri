'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import confetti from 'canvas-confetti';
import { drawWinnerAction } from '@/lib/admin-actions'; // Pass på at du importerer fra riktig fil!
// Hvis drawWinnerAction ligger i lib/actions.ts, endre linjen over til:
// import { drawWinnerAction } from '@/lib/actions';

interface WinnerRevealProps {
  takenTickets: { number: number; ownerName: string | null }[];
}

export default function WinnerReveal({ takenTickets }: WinnerRevealProps) {
  const router = useRouter();
  
  const [isDrawing, setIsDrawing] = useState(false);
  const [displayNumber, setDisplayNumber] = useState<number | null>(null);
  const [winnerData, setWinnerData] = useState<{ number: number; owner: string | null } | null>(null);
  
  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const safetyTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Funksjon for å rydde opp (stoppe animasjon)
  const stopAnimation = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    if (safetyTimeoutRef.current) {
      clearTimeout(safetyTimeoutRef.current);
      safetyTimeoutRef.current = null;
    }
  };

  const handleDraw = async () => {
    // Sjekk at vi faktisk har lodd å trekke fra
    if (!takenTickets || takenTickets.length === 0) {
      alert("Ingen lodd er solgt, kan ikke trekke vinner.");
      return;
    }

    setIsDrawing(true);
    setWinnerData(null);
    setDisplayNumber(0);

    // 1. Start "Lykkehjul"-animasjonen
    // Vi velger et tilfeldig tall fra listen over solgte lodd for visuell effekt
    intervalRef.current = setInterval(() => {
      const randomIndex = Math.floor(Math.random() * takenTickets.length);
      // Sikkerhetssjekk hvis arrayet er tomt midt i operasjonen
      if (takenTickets[randomIndex]) {
        setDisplayNumber(takenTickets[randomIndex].number);
      }
    }, 80);

    try {
      // 2. Kall serveren
      const result = await drawWinnerAction();

      if (!result.success) {
        stopAnimation();
        setIsDrawing(false);
        alert(result.message);
        return;
      }

      // 3. Hvis suksess, vent litt før vi viser resultatet (spenning)
      setTimeout(() => {
        stopAnimation(); // Stopp rullingen
        
        // Vis vinneren
        setDisplayNumber(result.winner!.number);
        setWinnerData(result.winner!);
        setIsDrawing(false);

        // 4. Konfetti
        fireConfetti();

        // 5. Oppdater statistikken på siden
        router.refresh();

      }, 3000); // 3 sekunder spenning

    } catch (error) {
      console.error("Feil under trekning:", error);
      stopAnimation();
      setIsDrawing(false);
      alert("Noe gikk galt under trekningen. Prøv igjen.");
    }
  };

  // Konfetti-logikk skilt ut i egen funksjon
  const fireConfetti = () => {
    const duration = 3000;
    const end = Date.now() + duration;

    const frame = () => {
      confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
        colors: ['#D4AF37', '#722F37', '#FFFFFF']
      });
      confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
        colors: ['#D4AF37', '#722F37', '#FFFFFF']
      });

      if (Date.now() < end) {
        requestAnimationFrame(frame);
      }
    };
    frame();
  };

  // Opprydding når komponenten forsvinner
  useEffect(() => {
    return () => stopAnimation();
  }, []);

  return (
    <div className="flex flex-col items-center justify-center min-h-[300px]">
      
      {/* Vinner-visning / Animasjon */}
      <div className="relative mb-8">
        <div className={`
          relative flex items-center justify-center w-64 h-64 rounded-full border-4 
          ${winnerData ? 'border-[#D4AF37] bg-[#D4AF37]/10 shadow-[0_0_50px_rgba(212,175,55,0.5)]' : 'border-[#722F37]/30 bg-[#1a0b0e]'}
          transition-all duration-500
        `}>
          
          {/* Sirkel-animasjon mens den trekker */}
          {isDrawing && (
            <div className="absolute inset-0 rounded-full border-t-4 border-[#D4AF37] animate-spin"></div>
          )}

          <div className="text-center">
            {displayNumber !== null ? (
              <>
                <div className="text-7xl font-bold text-white font-mono tracking-tighter">
                  #{displayNumber}
                </div>
                {winnerData && (
                   <div className="text-xl text-[#D4AF37] font-serif mt-2 animate-in slide-in-from-bottom-2 fade-in">
                     {winnerData.owner}
                   </div>
                )}
              </>
            ) : (
              <span className="text-gray-600 font-serif italic text-lg">Klar til trekning</span>
            )}
          </div>
        </div>
      </div>

      {/* Handlingsknapp */}
      {!winnerData && (
        <button
          onClick={handleDraw}
          disabled={isDrawing || takenTickets.length === 0}
          className="group relative px-8 py-4 bg-[#722F37] text-white font-bold text-xl uppercase tracking-widest rounded-lg shadow-xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#8a3842] transition-all hover:scale-105 active:scale-95"
        >
          <span className="relative z-10 flex items-center gap-2">
            {isDrawing ? 'Trekker...' : 'Trekk Vinner'}
          </span>
        </button>
      )}

      {/* Nullstill-knapp for visning */}
      {winnerData && (
        <button 
          onClick={() => { setWinnerData(null); setDisplayNumber(null); }}
          className="text-gray-500 hover:text-[#D4AF37] transition-colors mt-4 text-sm"
        >
          Gjør klar til neste
        </button>
      )}
    </div>
  );
}