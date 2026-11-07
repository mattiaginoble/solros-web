# Configuratore Casa

Pianificatore di interni per l'intera abitazione: si disegnano le stanze al
centimetro, si compongono in una casa con muri condivisi, si arredano con
prodotti reali e si ottiene un preventivo.

## Avvio rapido

Requisiti: Node.js 20 o superiore.

```bash
npm install            # installa le dipendenze e genera il client Prisma
cp .env.example .env   # configurazione locale (database SQLite)
npm run setup          # crea il database e carica catalogo demo e case di esempio
npm run dev            # http://localhost:3000
```

Comandi utili:

| Comando | Descrizione |
| --- | --- |
| `npm run dev` | server di sviluppo |
| `npm run build` / `npm start` | build e avvio di produzione |
| `npm test` | test unitari (Vitest) |
| `npm run typecheck` | controllo dei tipi TypeScript |
| `npm run lint` | ESLint |
| `npm run db:migrate` | applica/crea migrazioni durante lo sviluppo |
| `npm run db:seed` | carica catalogo demo (85 prodotti) e 3 case di esempio |
| `npm run db:reset` | ricrea il database da zero (e riesegue il seed) |

## Architettura

- **Next.js (App Router) + TypeScript + Tailwind**: interfaccia e API.
- **react-konva**: editor 2D della pianta.
- **three.js + react-three-fiber (drei)**: vista 3D.
- **Zustand + Immer**: stato dell'editor con undo/redo e salvataggio automatico.
- **Prisma + SQLite**: progetti, catalogo prodotti, utenti semplici.
- **pdf.js, PapaParse, jsPDF**: import di planimetrie PDF, import CSV, export PDF.
- **Vitest**: test della logica geometrica, dei prezzi, del catalogo e della
  cucina.

### Modello dati

`House → Floor → Room → { walls, openings, items }`, tutto in centimetri
(`src/domain/schema.ts`, schemi zod da cui derivano i tipi).

- Ogni stanza è un **poligono in coordinate locali** che rappresenta la faccia
  interna dei muri, più posizione e rotazione nel piano. Le misure inserite
  sono quindi quelle nette e l'area è quella calpestabile. Sono supportate forme
  qualsiasi, comprese quelle a L.
- `walls[i]` è il muro del lato `polygon[i] → polygon[i+1]` e ne definisce lo
  spessore; i muri crescono verso l'esterno del poligono.
- Le aperture (porte, finestre, passaggi) sono legate a un muro con distanza
  dall'angolo, larghezza, altezza e altezza da terra.

### Geometria dei muri

`src/lib/geometry/walls.ts` calcola i muri reali del piano a partire dalle
stanze: giunti a spigolo vivo, e **muri condivisi** riconosciuti in modo
geometrico (due lati affacciati a distanza pari allo spessore). Il tratto
condiviso viene generato una sola volta e forato dalle aperture di entrambe le
stanze, quindi spostando le stanze la condivisione si crea o si rompe da sola.

### Cartelle principali

```
src/domain/          modello dati, fabbriche, operazioni sulle stanze, modelli, case di esempio
src/lib/geometry/    vettori, poligoni, snap, muri derivati, collisioni, posizionamento
src/lib/pricing/     preventivo, export CSV e PDF
src/lib/server/      database, utente, lettura sicura di pagine web (solo server)
src/catalog/         CatalogProvider, filtri, catalogo demo, import CSV/JSON, metadati da link
src/floorplan/       caricamento, analisi della planimetria, analizzatore Claude
src/kitchen/         configuratore cucina (composizione moduli, finiture)
src/store/           stato dell'editor, azioni, autosalvataggio
src/components/      editor 2D (Konva), vista 3D, pannelli, dialoghi, home
src/app/api/         API REST (progetti, condivisione, utente, catalogo, planimetria)
prisma/              schema, migrazioni e seed
tests/               test Vitest
```

### Test

`npm test` esegue i test Vitest in `tests/`: geometria (poligoni, snap, muri
condivisi e unione delle stanze, collisioni, posizionamento degli arredi),
operazioni sulle stanze e sui piani, prezzi ed export CSV, filtri e import del
catalogo, metadati dei prodotti da link, protezioni della lettura di pagine
(SSRF, robots.txt), riconoscimento delle planimetrie su immagini sintetiche,
composizione della cucina e undo/redo dello stato.

## Utilizzo

- **Home**: crea una stanza dalle misure, parti da un modello o riapri un progetto.
- **Disegno**: strumento *Disegna* (tasto D), clic per i vertici con snap alla
  griglia, a 90° e agli allineamenti; digita una misura e premi Invio per un
  lato esatto; chiudi cliccando sul primo punto o con doppio clic.
- **Modalità Stanza**: trascina vertici e lati, doppio clic su un muro per
  aggiungere un vertice, modifica ogni lato dal pannello proprietà.
- **Aperture**: trascina porta, finestra o passaggio dalla barra su un muro,
  poi regola larghezza, altezza, altezza da terra, cerniera e verso.
- Scorciatoie: `Canc`, `Ctrl+Z`, `Ctrl+Maiusc+Z`, `R`, `Ctrl+D`, frecce, `Esc`
  (elenco completo dal pulsante "?" nell'editor).
- **Tablet**: tocco per selezionare e trascinare, due dita per lo zoom e lo
  spostamento della pianta. Sotto i 1024 px di larghezza il pannello con
  catalogo e stanze si apre dal pulsante in alto a destra.

## Composizione della casa

- In modalità **Casa** ogni stanza è un blocco trascinabile. Avvicinandola a
  un'altra, i lati affacciati si agganciano alla distanza dello spessore del
  muro esistente (evidenziati in blu) e diventano un **muro condiviso**; i
  muri di facciata si allineano sulla stessa retta (in arancione) e gli angoli
  vicini combaciano. Alt disattiva lo snap.
- **Unisci** (barra strumenti o pannello della stanza) accosta la stanza
  selezionata a quella scelta o alla più vicina, a qualsiasi distanza.
- Sul muro condiviso si aprono porte o passaggi come su qualsiasi muro;
  *Apri tutto il muro condiviso* crea un passaggio lungo l'intero tratto.
- Duplica (`Ctrl+D`), ruota (`R`), rinomina, colora e assegna un tipo
  (cucina, camera, bagno…) alle stanze; libreria di modelli pronti.
- **Piani**: dal selettore in alto si aggiungono piani sopra o sotto, con quota
  calcolata da soffitto e solaio; il piano sottostante resta visibile in
  trasparenza e si possono copiarne le stanze. Le scale del catalogo si
  collegano a un altro piano, dove compare il loro ingombro.

## Configuratore cucina

Dal pannello di una stanza (*Configura cucina*) o dal pulsante **Cucina** della
barra strumenti si apre il configuratore (`src/kitchen/`):

- composizione **lineare** su una parete o **ad angolo** su due pareti
  adiacenti, con lunghezze modificabili al centimetro;
- **riempimento automatico** delle misure con moduli base standard
  (30/40/60/80 cm, cassettiere) e un compensatore per il resto; i moduli si
  possono poi ridimensionare a mano e il compensatore si riadatta;
- pensili allineati alle basi, scolapiatti sopra il lavello, nessun pensile
  davanti alle finestre;
- elettrodomestici agganciati ai moduli compatibili: forno sotto il piano o in
  colonna, piano cottura a induzione o gas, lavastoviglie a scomparsa,
  frigorifero da incasso in colonna o a libera installazione, cappa
  sottopensile o a parete;
- scelta di frontali, maniglie e top, con prospetto frontale e **elenco
  componenti** con il prezzo totale.

Applicando la configurazione i moduli diventano oggetti della stanza (visibili
in pianta e in 3D) e entrano nel preventivo insieme alle finiture (sovrapprezzo
dei frontali, maniglie, zoccolo).

## Preventivo, condivisione ed export

- **Preventivo** (totale in alto a destra): righe aggregate con quantità,
  raggruppate per stanza o per rivenditore, oppure come lista della spesa;
  prezzi sempre con data di aggiornamento e avviso.
- **Esporta PDF** e **Esporta CSV** (nome, codice, rivenditore, link,
  quantità, prezzo unitario e totale, stanze); il CSV usa `;` e la virgola
  decimale per aprirsi correttamente in Excel in italiano.
- **Apri i link dei prodotti**: apre le pagine dei prodotti in nuove schede
  (il browser potrebbe chiedere di consentire i popup).
- Menu **Progetto**: link di condivisione in sola lettura (revocabile),
  esportazione del progetto in JSON, duplicazione. Dalla home si importa un
  progetto JSON esportato in precedenza.

## Vista 3D

Il pulsante **3D** in alto passa alla vista tridimensionale (stesso progetto,
nessuna conversione). Muri estrusi con i fori di porte e finestre, vetri e
ante, pavimenti e pareti con materiali e texture procedurali, arredi con
modello glTF se disponibile o modello parametrico generato dalla forma.

- **Orbita**: trascina per ruotare, tasto destro per spostare, rotella per lo zoom.
- **Camminata**: trascina per guardarti intorno, W A S D o frecce per muoverti
  (pulsanti a schermo su tablet); i muri bloccano il passaggio, le porte no.
- **Dall'alto**: vista ortografica in pianta.
- Si possono nascondere i soffitti e i piani superiori a quello attivo.
- Clic su un oggetto per selezionarlo e modificarlo dal pannello proprietà.

## Import di una planimetria

Dalla home (*Carica una planimetria*) o dal pulsante **Planimetria** della
barra strumenti si carica un file PNG, JPG o PDF (del PDF viene rasterizzata
la prima pagina con pdf.js, il cui worker è servito localmente da `public/`).

1. **Sfondo**: l'immagine diventa lo sfondo semitrasparente del piano
   (opacità, visibilità e posizione regolabili dal pannello del piano).
2. **Calibrazione**: si cliccano due punti di cui si conosce la distanza
   (es. un muro quotato) e si inserisce la misura reale in cm.
3. Due modalità:
   - **Ricalco assistito**: lo strumento *Disegna* aggancia i punti alle facce
     dei muri rilevate nell'immagine;
   - **Riconoscimento automatico**: stanze, porte e finestre vengono generate
     come bozza e restano modificabili come quelle disegnate a mano.

Il riconoscimento passa per l'astrazione `FloorplanAnalyzer`
(`src/floorplan/types.ts`) con due implementazioni:

| Analizzatore | Dove gira | Come funziona |
| --- | --- | --- |
| locale (predefinito) | nel browser, TypeScript puro | soglia di Otsu, stima degli spessori dei muri, aperture e chiusure morfologiche, regioni chiuse = stanze, varchi = porte, linee sottili nei muri = finestre |
| Claude vision | server, `POST /api/floorplan/analyze` | l'immagine viene inviata all'API Anthropic, che restituisce stanze e aperture in JSON validato |

Per attivare l'analizzatore remoto, in `.env`:

```bash
FLOORPLAN_ANALYZER="claude"
ANTHROPIC_API_KEY="..."
# facoltativo, predefinito claude-opus-5-5
ANTHROPIC_MODEL="claude-opus-5-5"
```

La richiesta usa gli output strutturati, controlla il `stop_reason` e, se i
filtri di sicurezza del modello rifiutano l'immagine, viene ripetuta
automaticamente sul modello di riserva consigliato (`fallbacks: "default"`).
Senza configurazione resta disponibile solo l'analizzatore locale.

## Catalogo prodotti

Il catalogo è costruito attorno all'interfaccia `CatalogProvider`
(`src/catalog/types.ts`): ogni sorgente restituisce i propri prodotti, mentre
ricerca testuale, filtri (rivenditore, categoria, prezzo, dimensioni, colore) e
faccette sono applicati in modo uniforme da `src/catalog/filter.ts`.

| Provider | Sorgente |
| --- | --- |
| `DemoProvider` | ~80 prodotti generici con prezzi indicativi, marcati "dati demo" |
| `FileImportProvider` | cataloghi e feed importati da CSV/JSON |
| `ProductLinkProvider` | prodotti precompilati dal link di una pagina prodotto |
| `ManualProvider` | prodotti personalizzati inseriti a mano |

I prezzi sono sempre mostrati con la data di aggiornamento e l'avviso che
possono essere cambiati. I rivenditori del catalogo demo sono fittizi.

### Importare un catalogo da CSV o JSON

Dal pannello Catalogo: **+ Aggiungi → Da file CSV o JSON**.

1. Scegli il file: CSV con intestazione (separatore `,` o `;`) oppure JSON
   (un elenco di prodotti, anche dentro `products`/`items`; i campi annidati
   come `offers.price` diventano colonne).
2. Le colonne vengono riconosciute dal nome (italiano o inglese: *nome/name*,
   *prezzo/price*, *larghezza/width*, *sku/codice*…) e si possono correggere.
   In alternativa alle tre misure basta una colonna *dimensioni* come
   `200x90x85 cm`.
3. Indica l'unità delle misure (cm, mm, m) e il rivenditore predefinito, poi
   controlla l'anteprima: le righe scartate sono elencate con il motivo.
4. *Importa*: i prodotti finiscono nel catalogo personale, raggruppati per
   lotto (reimportare lo stesso file aggiorna i prodotti, un lotto si può
   eliminare in blocco).

Il file [`docs/esempio-catalogo.csv`](docs/esempio-catalogo.csv) è un esempio
pronto. Prezzi e numeri accettano il formato italiano (`1.149,00`).

### Prodotto da link e prodotto manuale

**+ Aggiungi → Da link**: incolli l'indirizzo della pagina di un prodotto
(qualsiasi rivenditore) e l'app legge, con una sola richiesta e solo su tua
azione, i metadati pubblici della pagina (JSON-LD schema.org, Open Graph) per
precompilare nome, prezzo, immagine e misure, che confermi o correggi prima di
salvare. Nessuno scraping massivo: viene rispettato il `robots.txt` del sito,
c'è un intervallo minimo tra richieste allo stesso dominio, e il server rifiuta
indirizzi privati o locali (protezione SSRF), anche in forma IPv6 e anche se il
DNS cambia risposta dopo il primo controllo: l'indirizzo viene verificato al
momento della connessione. Se un sito non lo consente, il prodotto si inserisce
a mano (**Inserimento manuale**).

I link dei prodotti (pagina, immagine, modello 3D) accettano solo indirizzi
`http`/`https`; quelli scritti senza protocollo (`www.sito.it/...`) vengono
completati. Nell'export CSV i testi che inizierebbero una formula (`=`, `+`,
`-`, `@`) sono preceduti da un apostrofo, così Excel non li esegue.

### Aggiungere un nuovo CatalogProvider

1. Crea un file in `src/catalog/providers/`, ad esempio `mioFeed.ts`:

   ```ts
   import "server-only";
   import type { CatalogProvider } from "../types";

   export const MioFeedProvider: CatalogProvider = {
     id: "import",               // una delle sorgenti di ProductSource
     label: "Feed Mio Negozio",
     description: "Prodotti dal feed affiliato di Mio Negozio",
     async list(ctx) {
       // restituisci Product[] (vedi ProductSchema in src/domain/schema.ts)
       return [];
     },
   };
   ```

2. Registralo in `CATALOG_PROVIDERS` in `src/catalog/service.ts`.

Ogni prodotto ha: id, rivenditore, nome, categoria e sottocategoria,
larghezza/profondità/altezza in cm, prezzo e valuta, colore, immagine, URL,
tipo di montaggio (pavimento, parete, soffitto), ingombro di rispetto
(spazio frontale e laterale) e modello glTF opzionale. Senza glTF il 3D usa
una forma parametrica (`shape`).

## Arredi in pianta

- Trascina un prodotto dal catalogo sulla pianta, oppure usa **+** per
  inserirlo nella stanza selezionata in un punto libero.
- Durante il trascinamento l'oggetto si aggancia alle pareti (anche in
  angolo), al centro della stanza e ai bordi degli altri oggetti; tieni
  premuto Alt per muoverlo liberamente.
- La maniglia davanti all'oggetto lo ruota a passi di 15°; `R` ruota di 90°.
- Collisioni, oggetti fuori stanza, porte bloccate e ingombri di apertura
  occupati sono evidenziati in rosso e spiegati nel pannello proprietà.
- Gli oggetti a parete (pensili, specchi, applique) hanno l'altezza da terra
  regolabile e non collidono con i mobili a terra sottostanti.
