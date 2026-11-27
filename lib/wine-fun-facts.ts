// Generelle fun facts om vin vises i en egen boks på forsiden. Selve factene
// ligger i databasen (tabellen FunFact, se lib/quiz-bank.ts). Kontrollert
// liste (ikke AI), så de er sanne.
//
// Rent modul: brukes både på serveren (første fact) og i klienten («Trekk en ny»).

// Tilfeldig indeks blant `count` facts, ulik `except` (så «trekk en ny» alltid gir en annen).
export function pickFunFactIndex(count: number, except?: number): number {
  if (except === undefined || count < 2) return Math.floor(Math.random() * count);
  const i = Math.floor(Math.random() * (count - 1));
  return i >= except ? i + 1 : i;
}
