'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { fireConfetti, playWinSound, speakWinner } from './drawEffects';
import { drawWinnerAction } from '@/lib/admin-actions'; // Pass på at du importerer fra riktig fil!
// Hvis drawWinnerAction ligger i lib/actions.ts, endre linjen over til:
// import { drawWinnerAction } from '@/lib/actions';

interface WinnerRevealProps {
  takenTickets: { number: number; ownerName: string | null }[];
  large?: boolean; // Storskjermvisning (trekningssiden)
}

export default function WinnerReveal({ takenTickets, large = false }: WinnerRevealProps) {
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
      alert("Ingen lodd i potten, kan ikke trekke vinner.");
      return;
    }

    setIsDrawing(true);
    setWinnerData(null);
    setDisplayNumber(0);

    const startSpinning = () => {
      intervalRef.current = setInterval(() => {
        const randomIndex = Math.floor(Math.random() * takenTickets.length);
        if (takenTickets[randomIndex]) {
          setDisplayNumber(takenTickets[randomIndex].number);
        }
      }, 80);
    };

    startSpinning();

    try {
      const result = await drawWinnerAction();

      if (!result.success) {
        stopAnimation();
        setIsDrawing(false);
        alert(result.message);
        return;
      }

      // 3 sekunder spenning
      setTimeout(() => {
        stopAnimation();
        setDisplayNumber(result.winner!.number);
        setIsDrawing(false);

        if (result.winner!.owner) {
          // Solgt lodd – vis vinner, konfetti og lyd
          setWinnerData(result.winner!);
          fireConfetti();
          playWinSound();
          speakWinner(result.winner!.number, result.winner!.owner);
          router.refresh();
        } else {
          // Usolgt lodd – vis nummeret i 1 sekund, nullstill deretter
          setTimeout(() => {
            setDisplayNumber(null);
            router.refresh();
          }, 3000);
        }
      }, 3000);

    } catch (error) {
      console.error("Feil under trekning:", error);
      stopAnimation();
      setIsDrawing(false);
      alert("Noe gikk galt under trekningen. Prøv igjen.");
    }
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
          relative flex items-center justify-center rounded-full border-4 ${large ? 'w-[28rem] h-[28rem] max-w-[80vw] max-h-[80vw]' : 'w-64 h-64'}
          ${winnerData ? 'winner-ring-active' : 'winner-ring'}
          transition-all duration-500
        `}>

          {/* Sirkel-animasjon mens den trekker */}
          {isDrawing && (
            <div className="absolute inset-0 rounded-full border-t-4 wine-accent-border animate-spin"></div>
          )}

          <div className="text-center">
            {displayNumber !== null ? (
              <>
                <div className={`${large ? 'text-9xl' : 'text-7xl'} font-bold wine-text font-mono tracking-tighter`}>
                  #{displayNumber}
                </div>
                {winnerData && (
                   <div className={`${large ? 'text-4xl px-6' : 'text-xl'} wine-accent font-serif mt-2 animate-in slide-in-from-bottom-2 fade-in`}>
                     {winnerData.owner ?? 'Ikke solgt – ingen vinner'}
                   </div>
                )}
              </>
            ) : (
              <span className="wine-text-subtle font-serif italic text-lg">Klar til trekning</span>
            )}
          </div>
        </div>
      </div>

      {/* Handlingsknapp */}
      {!winnerData && (
        <button
          onClick={handleDraw}
          disabled={isDrawing || takenTickets.length === 0}
          className="wine-cta group relative px-8 py-4 font-bold text-xl rounded-lg shadow-xl overflow-hidden disabled:opacity-50 disabled:cursor-not-allowed hover:scale-105 active:scale-95 transition-transform"
        >
          <span className="relative z-10 flex items-center gap-2">
            {isDrawing ? 'Trekker...' : 'Trekk vinner'}
          </span>
        </button>
      )}

      {/* Nullstill-knapp for visning */}
      {winnerData && (
        <button
          onClick={() => { setWinnerData(null); setDisplayNumber(null); }}
          className="wine-link mt-4 text-sm"
        >
          Gjør klar til neste
        </button>
      )}
    </div>
  );
}