'use client';

import confetti from 'canvas-confetti';

// Felles effekter for trekningsvisningene: konfetti, vinnermelodi og opplesning.

// Konfetti-logikk skilt ut i egen funksjon
export function fireConfetti() {
  const duration = 3000;
  const end = Date.now() + duration;

  const frame = () => {
    confetti({
      particleCount: 5,
      angle: 60,
      spread: 55,
      origin: { x: 0 },
      colors: ['#C79A3E', '#7A2B35', '#F3ECE2']
    });
    confetti({
      particleCount: 5,
      angle: 120,
      spread: 55,
      origin: { x: 1 },
      colors: ['#C79A3E', '#7A2B35', '#F3ECE2']
    });

    if (Date.now() < end) {
      requestAnimationFrame(frame);
    }
  };
  frame();
}

export function speakWinner(number: number, owner: string | null) {
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
}

// Tilfeldig vinnermelodi via Web Audio API (ingen lydfiler nødvendig)
export function playWinSound() {
  const AudioContext = window.AudioContext || (window as unknown as { webkitAudioContext: typeof window.AudioContext }).webkitAudioContext;
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
}
