// Generelle fun facts om vin, vist i en egen boks på forsiden. En ny trekkes
// tilfeldig hver gang siden lastes. Kontrollert liste (ikke AI), så de er sanne.

export const WINE_FUN_FACTS = [
'Speyer-flasken er verdens eldste uåpnede vinflaske. Den er fra rundt år 325 e.Kr. og står på museum i Speyer i Tyskland.',
'De eldste kjente sporene etter vinproduksjon er rundt 8000 år gamle og er funnet i Georgia.',
'Munken Dom Pérignon fant ikke opp musserende vin. Han brukte tvert imot lang tid på å hindre at vinen fikk bobler.',
'Trykket i en champagneflaske er rundt 6 bar. Det er to til tre ganger så mye som i et bildekk.',
'På slutten av 1800-tallet ødela vinrotlusen (phylloxera) det meste av Europas vinmarker. Løsningen ble å pode europeiske vinstokker på amerikanske røtter, og slik dyrkes de fleste fortsatt.',
'Cabernet Sauvignon er en naturlig krysning av Cabernet Franc og Sauvignon Blanc. Det viste DNA-tester på 1990-tallet.',
'Saften i de fleste blå druer er klar, og fargen i rødvin kommer fra skallet. Derfor kan man lage hvit champagne av blå Pinot Noir-druer.',
'Kork er bark fra korkeika. Barken høstes omtrent hvert niende år uten at treet felles, og Portugal står for rundt halvparten av verdensproduksjonen.',
'Zinfandel i California og Primitivo i Italia er samme drue. Opprinnelig kommer den fra Kroatia.',
'Syrah og Shiraz er samme drue. Hvilket navn som brukes, avhenger mest av hvor vinen er laget og hvilken stil den har.',
'Carmenère forsvant nesten helt fra Europa etter vinrotlusen. I 1994 ble druen gjenoppdaget i Chile, der den i årevis hadde blitt dyrket som Merlot.',
'Tårene som renner nedover innsiden av glasset, oppstår fordi alkohol fordamper raskere enn vann (Marangoni-effekten). De sier noe om alkoholinnholdet, men ingenting om kvaliteten.',
'Isvin lages av druer som høstes frosne rett fra vinstokken, gjerne ved sju minusgrader eller kaldere.',
'Søte viner som Sauternes og Tokaji får konsentrasjonen sin fra edelråte, en sopp som får druene til å tørke inn.',
'I blindtesten «Judgement of Paris» i 1976 slo californiske viner de beste franske, til de franske dommernes store forskrekkelse.',
'Pinot Noir er genetisk ustabil. Både Pinot Gris og Pinot Blanc er mutasjoner av den.',
'Rosévin lages som regel ved at saften får kort kontakt med skallet på blå druer, ikke ved å blande rødt og hvitt. Rosé-champagne er et av få unntak.',
'Portvin er søt fordi man tilsetter druebrennevin mens vinen gjærer. Da stopper gjæringen, og noe av druesukkeret blir igjen.',
'Chablis lages av Chardonnay, men druenavnet står sjelden på etiketten.',
'Malbec kommer opprinnelig fra Sørvest-Frankrike, men i dag er den Argentinas viktigste drue.',
'Petroleumsduften i moden Riesling kommer fra stoffet TDN, som dannes mens vinen lagres.',
'Tanniner gir en tørr, snerpende følelse i munnen fordi de binder seg til proteiner i spyttet.',
'Vinmonopolet ble etablert i 1922, mens Norge fortsatt hadde brennevinsforbud.',
'En magnum rommer 1,5 liter, altså to vanlige flasker. Mange mener at vin modnes langsommere i store flasker.',
'Nebbiolo, druen i Barolo og Barbaresco, har trolig fått navnet sitt fra nebbia, det italienske ordet for tåke.',
'Madame Clicquot i champagnehuset Veuve Clicquot fant i 1816 opp et eget bord for remuage. Der ble flaskene vridd og vippet litt etter litt med halsen ned, slik at bunnfallet samlet seg ved korken og kunne fjernes.',
'Champagne uten årgang må lagres i minst 15 måneder før den kan selges. Årgangschampagne må lagres i minst tre år.',
'I Georgia lages vin fortsatt i qvevri, eggformede leirkar som graves ned i bakken. Metoden kom på UNESCOs liste over immateriell kulturarv i 2013.',
'Müller-Thurgau ble lenge regnet som en krysning av Riesling og Silvaner, og derfra kommer synonymet Riesling-Sylvaner. DNA-tester har senere vist at den andre forelderen er bordruen Madeleine Royale.',
'Château Mouton Rothschild har hatt en ny kunstneretikett hvert år siden 1945, blant annet av Dalí og Warhol. I 1973 ble vinhuset rykket opp fra andre til første klasse, som det eneste i Bordeaux-klassifiseringen fra 1855.',
'Druen bak prosecco het også Prosecco, men i 2009 ble den omdøpt til Glera. Da kunne navnet Prosecco forbeholdes viner fra det beskyttede området.',
'DNA-tester har vist at Chardonnay er en krysning av Pinot og den lite kjente druen Gouais Blanc.',
'Merlot er en krysning av Cabernet Franc og den nesten ukjente druen Magdeleine Noire des Charentes. Dermed er Merlot halvsøsken av Cabernet Sauvignon.',
'Pinotage ble krysset fram i Sør-Afrika i 1925 av Pinot Noir og Cinsaut. Der het Cinsaut den gang Hermitage, og derfra kommer navnet Pinotage.',
'Et vanlig Bordeaux-fat (barrique) rommer 225 liter. Det holder til 300 vanlige flasker.',
'De små krystallene du av og til finner på korken eller i bunnen av flasken, er vinsten. Det er ufarlige salter av vinsyre, ikke glass.',
'Korksmak skyldes stoffet TCA (2,4,6-trikloranisol). Det er nok med noen få nanogram per liter før mange kjenner det.',
'Gjæren lager selv litt sulfitt under gjæringen, så helt sulfittfri vin finnes i praksis ikke.',
'Beaujolais Nouveau slippes den tredje torsdagen i november. Vinen lages av Gamay og er på flaske bare noen uker etter innhøstingen.',
'Château d\'Yquem i Sauternes var den eneste vinen som fikk klassen Premier Cru Supérieur i klassifiseringen fra 1855.',
'Fino-sherry modnes under et lag med gjær, kalt flor, som ligger oppå vinen og beskytter den mot luft.',
'Madeira varmes opp med vilje under produksjonen. Derfor kan en åpnet flaske stå i månedsvis uten å bli dårlig.',
'Den greske vinen retsina er smaksatt med harpiks fra aleppofuru.',
'Navnet Tempranillo kommer av temprano, det spanske ordet for tidlig, fordi druen modner tidlig.',
'Grenache, Garnacha og Cannonau er samme drue. Navnene brukes i henholdsvis Frankrike, Spania og på Sardinia.',
'Gewürz betyr krydder på tysk, og Gewürztraminer er en aromatisk variant av den gamle druen Traminer.',
'Navnet Sauvignon kommer trolig av det franske ordet sauvage, som betyr vill.',
'Amarone lages av druer som tørkes i flere måneder før de presses. Det gir en kraftig vin med høy alkohol.',
'Prosecco får boblene sine i store ståltanker, mens champagne gjærer andre gang på hver enkelt flaske.',
'Chianti Classico kjennes igjen på den svarte hanen (gallo nero) på flasken.',
];

// Tilfeldig indeks i listen, ulik `except` (så «trekk en ny» alltid gir en annen).
export function pickFunFactIndex(except?: number): number {
  const n = WINE_FUN_FACTS.length;
  if (except === undefined || n < 2) return Math.floor(Math.random() * n);
  const i = Math.floor(Math.random() * (n - 1));
  return i >= except ? i + 1 : i;
}
