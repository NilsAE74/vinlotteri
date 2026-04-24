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

  const speakWinner = (number: number, owner: string | null) => {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();

    const text = owner
      ? `Nummer ${number}... ${owner}!`
      : `Nummer ${number}`;

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'nb-NO';
    utterance.rate = 0.82;
    utterance.pitch = 1.05;

    const trySpeak = () => {
      const voices = window.speechSynthesis.getVoices();
      const norwegianVoice = voices.find(v => v.lang.startsWith('nb') || v.lang.startsWith('no'));
      if (norwegianVoice) utterance.voice = norwegianVoice;
      window.speechSynthesis.speak(utterance);
    };

    // Voices may not be loaded yet on first call
    if (window.speechSynthesis.getVoices().length > 0) {
      trySpeak();
    } else {
      window.speechSynthesis.addEventListener('voiceschanged', trySpeak, { once: true });
    }
  };

  // Tilfeldig vinnermelodi via Web Audio API (ingen lydfiler nødvendig)
  const playWinSound = () => {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();

    const patterns = [
      // Oppadgående fanfare: C-E-G-C
      (ctx: AudioContext) => {
        [261.63, 329.63, 392.00, 523.25].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'square';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.25, ctx.currentTime + i * 0.15);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.15 + 0.3);
          osc.start(ctx.currentTime + i * 0.15);
          osc.stop(ctx.currentTime + i * 0.15 + 0.35);
        });
      },
      // Triumf-akkorder
      (ctx: AudioContext) => {
        [[261.63, 329.63, 392.00], [349.23, 440.00, 523.25]].forEach((chord, ci) => {
          chord.forEach(freq => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.connect(gain); gain.connect(ctx.destination);
            osc.type = 'triangle';
            osc.frequency.value = freq;
            gain.gain.setValueAtTime(0.18, ctx.currentTime + ci * 0.45);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ci * 0.45 + 0.5);
            osc.start(ctx.currentTime + ci * 0.45);
            osc.stop(ctx.currentTime + ci * 0.45 + 0.55);
          });
        });
      },
      // Slotmaskin-jingle: G-G-G-E-G-C
      (ctx: AudioContext) => {
        const notes =     [392, 392, 392, 329.63, 392, 523.25];
        const durations = [0.1, 0.1, 0.1,   0.15, 0.1,   0.45];
        let t = ctx.currentTime;
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain); gain.connect(ctx.destination);
          osc.type = 'sine';
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.3, t);
          gain.gain.exponentialRampToValueAtTime(0.001, t + durations[i]);
          osc.start(t);
          osc.stop(t + durations[i] + 0.05);
          t += durations[i] + 0.05;
        });
      },
    ];

    const pattern = patterns[Math.floor(Math.random() * patterns.length)];
    pattern(ctx);
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
                     {winnerData.owner ?? 'Ikke solgt – ingen vinner'}
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