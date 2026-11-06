# Configuratore Casa

Pianificatore di interni per l'intera abitazione: si disegnano le stanze al
centimetro, si compongono in una casa con muri condivisi, si arredano con
prodotti reali e si ottiene un preventivo.

## Avvio rapido

Requisiti: Node.js 20 o superiore.

```bash
npm install            # installa le dipendenze e genera il client Prisma
cp .env.example .env   # configurazione locale (database SQLite)
npm run setup          # crea il database
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
| `npm run db:reset` | ricrea il database da zero |

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
