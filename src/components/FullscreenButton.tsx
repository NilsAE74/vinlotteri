'use client';

import { useEffect, useState } from 'react';
import { Maximize, Minimize } from 'lucide-react';

export default function FullscreenButton() {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, []);

  const toggle = () => {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen?.();
  };

  return (
    <button
      onClick={toggle}
      title={isFullscreen ? 'Avslutt fullskjerm' : 'Fullskjerm'}
      className="p-2 rounded-lg wine-text-muted hover:text-[#D4AF37] transition-colors"
    >
      {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
    </button>
  );
}
