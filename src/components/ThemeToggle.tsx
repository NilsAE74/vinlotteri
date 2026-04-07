'use client';
import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export default function ThemeToggle({ initialTheme }: { initialTheme: 'dark' | 'light' }) {
  const [theme, setTheme] = useState<'dark' | 'light'>(initialTheme);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', initialTheme);
  }, [initialTheme]);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    document.cookie = `admin-theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
  };

  return (
    <button
      onClick={toggle}
      className="p-2 rounded-lg border border-[#722F37]/50 text-[#D4AF37] hover:bg-[#722F37]/20 transition-all"
      title={theme === 'dark' ? 'Bytt til lyst tema' : 'Bytt til mørkt tema'}
    >
      {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
    </button>
  );
}
