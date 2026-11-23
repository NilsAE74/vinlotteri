// Generelle fun facts om vin til AI-oppsummeringen. En fast liste i stedet for
// at modellen finner på selv, siden den ellers lett dikter opp «fakta».
// Én trekkes tilfeldig hver gang oppsummeringen lages.

export const WINE_FUN_FACTS = [
  'Verdens eldste uåpnede vinflaske, Speyer-flasken, er fra rundt år 325 e.Kr. og står på museum i Tyskland.',
  'De eldste kjente sporene etter vinproduksjon er funnet i Georgia og er rundt 8000 år gamle.',
  'Munken Dom Pérignon fant ikke opp musserende vin – han jobbet tvert imot lenge med å unngå at vinen fikk bobler.',
  'Trykket i en champagneflaske er rundt 6 bar, to–tre ganger så høyt som i et bildekk.',
  'På slutten av 1800-tallet ødela vinlusen (phylloxera) det meste av Europas vinmarker. Løsningen var å pode europeiske vinstokker på amerikanske røtter, og slik står de fleste fortsatt i dag.',
  'Cabernet Sauvignon er en naturlig krysning av Cabernet Franc og Sauvignon Blanc, noe DNA-tester avslørte på 1990-tallet.',
  'Saften i de fleste blå druer er klar; fargen i rødvin kommer fra skallet. Derfor kan hvit champagne lages av blå Pinot Noir-druer.',
  'Kork er barken fra korkeika. Den høstes omtrent hvert niende år uten at treet felles, og Portugal står for rundt halvparten av verdens produksjon.',
  'Zinfandel i California og Primitivo i Italia er samme drue, og den stammer opprinnelig fra Kroatia.',
  'Syrah og Shiraz er samme drue – navnet avhenger mest av hvor vinen er laget og hvilken stil den har.',
  'Druen Carmenère ble regnet som utryddet etter vinlusen, men ble gjenoppdaget i Chile i 1994, der den i årevis hadde blitt dyrket som Merlot.',
  'Tårene som renner nedover innsiden av glasset skyldes at alkohol fordamper raskere enn vann (Marangoni-effekten), og sier ingenting om kvaliteten.',
  'Isvin lages av druer som høstes frosne på vinstokken, gjerne ved sju minusgrader eller kaldere.',
  'Søte viner som Sauternes og Tokaji får sin konsentrasjon fra edelråte, en sopp som tørker inn druene.',
  'I den berømte blindtesten «Judgement of Paris» i 1976 slo viner fra California de beste franske, til stor forskrekkelse for de franske dommerne.',
  'Pinot Noir er genetisk ustabil, og både Pinot Gris og Pinot Blanc er mutasjoner av den.',
  'Rosévin lages som regel ved at saften får kort kontakt med skallet på blå druer, ikke ved å blande rødt og hvitt. Rosé-champagne er et av få unntak.',
  'Portvin er søt fordi man tilsetter druebrennevin under gjæringen. Da stopper gjæren, og noe av druesukkeret blir igjen.',
  'Chablis er laget av Chardonnay, selv om druen sjelden står på etiketten.',
  'Malbec kommer opprinnelig fra Sørvest-Frankrike, men er i dag Argentinas viktigste drue.',
  'Den karakteristiske petroleumsduften i moden Riesling kommer fra stoffet TDN, som dannes når vinen lagres.',
  'Den tørre, snerpende følelsen fra tanniner kommer av at de binder seg til proteiner i spyttet.',
  'Vinmonopolet ble etablert i 1922, mens Norge ennå hadde forbud mot brennevin.',
  'En magnum rommer 1,5 liter, altså to vanlige flasker. Mange mener vin modnes jevnere i store flasker.',
  'Navnet på druen Nebbiolo, som brukes i Barolo og Barbaresco, kommer trolig av nebbia, det italienske ordet for tåke.',
];

export function pickFunFact(): string {
  return WINE_FUN_FACTS[Math.floor(Math.random() * WINE_FUN_FACTS.length)];
}
