'use client';

import { useState } from 'react';
import { bookTicket } from '@/lib/actions';
import { Loader2 } from 'lucide-react';

interface TicketDialogProps {
  ticketNumbers: number[]; // Endret fra ticketNumber til array
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;   // Ny callback for å tømme valgte lodd i griden
  nameSuggestions?: string[]; // Navn fra Ansatte-tabellen
}

const PRICE_PER_TICKET = 5;
const SAVED_NAME_KEY = 'vinlotteri-navn';

// Navnet fra forrige kjøp på denne enheten. localStorage kan mangle eller
// kaste (privat modus, blokkert lagring), så alt er pakket inn i try/catch.
function readSavedName(): string {
  if (typeof window === 'undefined') return '';
  try {
    return window.localStorage.getItem(SAVED_NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string) {
  try {
    window.localStorage.setItem(SAVED_NAME_KEY, name);
  } catch {
    // Ikke kritisk – da må navnet bare skrives inn neste gang
  }
}
const VIPPS_URL = 'https://qr.vipps.no/box/aae883d3-b423-4666-a1c3-4d0c6c3749f6/pay-in';

// Kjøpet skjer i to steg:
//   1. Skriv navn og bekreft → loddene reserveres.
//   2. Betal med Vipps (QR på desktop, knapp på mobil).
export default function TicketDialog({ ticketNumbers, isOpen, onClose, onSuccess, nameSuggestions = [] }: TicketDialogProps) {
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Settes når kjøpet er bekreftet. Tar vare på loddene, siden utvalget i
  // rutenettet tømmes med en gang.
  const [confirmed, setConfirmed] = useState<{ name: string; numbers: number[] } | null>(null);
  // Forhåndsutfylt med navnet fra forrige kjøp på denne enheten
  const [name, setName] = useState(readSavedName);

  if (!isOpen) return null;

  function handleClose() {
    setConfirmed(null);
    setError(null);
    onClose();
  }

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);

    const numbers = [...ticketNumbers];
    // Send arrayet som en JSON-streng
    formData.append('numbers', JSON.stringify(numbers));

    // Skrives navnet likt som i ansattlisten (uansett store/små bokstaver),
    // bruk skrivemåten fra listen. Da gjenkjennes samme person på tvers av kjøp.
    const typed = String(formData.get('name') ?? '').trim().replace(/\s+/g, ' ');
    const canonical = nameSuggestions.find(n => n.toLocaleLowerCase('nb') === typed.toLocaleLowerCase('nb')) ?? typed;
    formData.set('name', canonical);

    const result = await bookTicket(formData);

    if (result.success) {
      saveName(canonical);
      setName(canonical);
      setConfirmed({ name: canonical, numbers });
      onSuccess(); // Tøm utvalget i rutenettet
    } else {
      setError(result.message || "Noe gikk galt");
    }
    setIsPending(false);
  }

  const numbers = confirmed?.numbers ?? ticketNumbers;
  const amount = numbers.length * PRICE_PER_TICKET;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[#1a0b0e] border border-[#722F37] rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="bg-[#722F37] p-4 text-center">
          <h2 className="text-xl font-serif text-[#D4AF37]">
            {confirmed
              ? `Takk${confirmed.name ? `, ${confirmed.name}` : ''}!`
              : `Kjøp ${numbers.length} lodd · ${amount} kr`}
          </h2>
          <p className="text-xs text-[#D4AF37]/80 mt-1">
            {confirmed ? 'Dine lodd: ' : 'Loddnr: '}
            {numbers.join(', ')}
          </p>
        </div>

        {!confirmed ? (
          // --- Steg 1: navn og bekreftelse ---
          <form action={handleSubmit} className="p-6 space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-300 mb-1">Navn</label>
              <input
                name="name"
                id="name"
                type="text"
                required
                // Tastaturet åpnes bare når navnet mangler
                autoFocus={!name}
                value={name}
                onChange={e => setName(e.target.value)}
                list={nameSuggestions.length > 0 ? 'ansatte-navn' : undefined}
                autoComplete="name"
                placeholder="Skriv eller velg navnet ditt"
                className="w-full bg-[#2a1216] border border-[#5a252c] rounded-md p-3 text-white focus:outline-none focus:ring-2 focus:ring-[#D4AF37] transition-all"
              />
            </div>

            {nameSuggestions.length > 0 && (
              <datalist id="ansatte-navn">
                {nameSuggestions.map(n => <option key={n} value={n} />)}
              </datalist>
            )}

            {error && (
              <div className="text-red-400 text-sm bg-red-900/20 p-2 rounded border border-red-900/50">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
              >
                Avbryt
              </button>
              <button
                type="submit"
                // Med navnet allerede utfylt holder det å trykke Enter / «Bekreft»
                autoFocus={!!name}
                disabled={isPending}
                className="px-6 py-2 bg-[#D4AF37] text-[#1a0b0e] font-bold rounded-md hover:bg-[#b5952f] transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                {isPending ? 'Bekrefter...' : 'Bekreft kjøp'}
              </button>
            </div>
          </form>
        ) : (
          // --- Steg 2: betaling ---
          <div className="p-6 flex flex-col items-center gap-3 text-center">
            <p className="text-sm text-gray-300">
              Loddene er dine. Betal <span className="font-bold text-[#D4AF37]">{amount} kr</span> med Vipps for å fullføre.
            </p>
            {/* QR-kode på desktop */}
            <div className="hidden md:block bg-white rounded-xl p-2 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/qr.png?v=2" alt="Vipps QR-kode" width={160} height={160} />
            </div>
            <p className="hidden md:block text-xs text-gray-500">Skann med kameraet eller Vipps-appen</p>
            {/* Lenke på mobil */}
            <a
              href={VIPPS_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="md:hidden w-full flex items-center justify-center gap-2 px-5 py-3 bg-[#FF5B24] text-white font-bold rounded-lg hover:bg-[#e04e1e] transition-colors"
            >
              Betal {amount} kr med Vipps
            </a>
            <button
              type="button"
              onClick={handleClose}
              className="mt-1 px-6 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Ferdig
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
