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
| `npm test` | test unitari (Vitest) |
| `npm run typecheck` | controllo dei tipi TypeScript |
| `npm run lint` | ESLint |
| `npm run db:migrate` | applica/crea migrazioni durante lo sviluppo |
| `npm run db:seed` | carica catalogo demo (85 prodotti) e 3 case di esempio |
| `npm run db:reset` | ricrea il database da zero (e riesegue il seed) |

## Architettura

- **Next.js (App Router) + TypeScript + Tailwind**: interfaccia e API.
- **react-konva**: editor 2D della pianta.
- **Zustand + Immer**: stato dell'editor con undo/redo e salvataggio automatico.
- **Prisma + SQLite**: progetti, catalogo prodotti, utenti semplici.
- **Vitest**: test della logica geometrica e dei prezzi.

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
src/domain/          modello dati, fabbriche, operazioni sulle stanze, modelli
src/lib/geometry/    vettori, poligoni, snap, muri derivati (testati)
src/store/           stato dell'editor, azioni, autosalvataggio
src/components/      editor 2D (Konva), pannelli, home
src/app/api/         API REST (progetti, condivisione, utente)
tests/               test Vitest
```

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
