// AI-oppsummering av ukens viner, laget med Googles Gemini API (gratisnivået).
// Vanlig servermodul: brukes bare fra server actions, så API-nøkkelen aldri
// når nettleseren.
//
// Oppsummeringen bygger kun på faktaene fra Vinmonopolet, så modellen ikke skal
// finne på årganger, karakterer eller lignende.

import type { WineDetails } from './wine-details-map';

const SYSTEM_PROMPT =
  'Du skriver en kort oppsummering av ukens viner til et vinlotteri på jobben, på norsk bokmål. ' +
  'Skriv 3–4 setninger, maks 80 ord, som løpende tekst. Tonen er seriøs og kunnskapsrik, men med et lett glimt i øyet. ' +
  'Gi et inntrykk av helheten: hvor vinene kommer fra, stil og hva de passer til, og nevn gjerne vinene ved navn. ' +
  'Bruk BARE faktaene du får; ikke finn på årganger, karakterer, priser eller historier. ' +
  'Ingen emojier, ingen overskrift, ingen punktlister, ingen anførselstegn.';

// Gratisnivået er tidvis overbelastet (503), så vi prøver flere modeller.
// «-latest» er aliaser som Google holder oppdatert.
function models() {
  const list = [process.env.GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-2.5-flash', 'gemini-flash-latest'];
  return [...new Set(list.filter((m): m is string => !!m && /^[\w.-]+$/.test(m)))];
}

// Fakta som ikke sendes til modellen:
// - Pris: oppsummeringen skal ikke handle om pris.
// - Produsent som er et selskap (AS/ASA): hos Vinmonopolet står ofte importøren
//   her (f.eks. «Oslo Wine Agency As»), ikke den egentlige produsenten.
function isUsefulFact(f: { label: string; value: string }) {
  if (f.label === 'Pris') return false;
  if (f.label === 'Produsent' && /\bA\/?SA?\.?$/i.test(f.value.trim())) return false;
  return true;
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  error?: { message?: string };
};

export async function generateWeeklySummary(wines: WineDetails[]): Promise<string | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn('GEMINI_API_KEY mangler – hopper over AI-oppsummering');
    return null;
  }
  if (wines.length === 0) return null;

  const facts = wines.map(d => ({
    navn: d.name,
    fakta: d.facts.filter(isUsefulFact),
    egenskaper: d.characteristics.map(c => `${c.label}: ${c.value} av ${c.max}`),
    notater: d.notes,
    passerTil: d.pairings,
  }));

  for (const model of models()) {
    try {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': key, 'content-type': 'application/json' },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
          contents: [{ role: 'user', parts: [{ text: `Ukens viner:\n${JSON.stringify(facts)}` }] }],
        }),
        signal: AbortSignal.timeout(20_000),
        cache: 'no-store',
      });
      const data: GeminiResponse = await res.json().catch(() => ({}));
      if (!res.ok) {
        console.warn(`Gemini ${model}: HTTP ${res.status} ${data.error?.message ?? ''}`);
        continue; // Prøv neste modell
      }
      const text = data.candidates?.[0]?.content?.parts?.map(p => p.text ?? '').join('').trim();
      if (text) return text.slice(0, 1000);
    } catch (error) {
      console.warn(`Gemini ${model} feilet:`, error instanceof Error ? error.name : error);
    }
  }
  return null;
}
