# Configuratore Casa

Interior planner for the whole home: draw rooms to the centimetre, compose
them into a house with shared walls, furnish them with real products and get
a quote.

The user interface is in Italian; button and menu names below are quoted as
they appear in the app, with an English translation.

**Online:** https://solros-web.vercel.app — the full version, on Vercel with a
Turso database, protected by a password (see
[Deploying online](#deploying-online-vercel--turso)). A public demo that runs
entirely in the browser is published at https://mattiaginoble.github.io/solros-web/
(see [Static version](#static-version-browser-only)).

## Quick start

Requirements: Node.js 20 or later.

```bash
npm install            # installs dependencies and generates the Prisma client
cp .env.example .env   # local configuration (SQLite database)
npm run setup          # creates the database and loads the demo catalogue and example houses
npm run dev            # http://localhost:3000
```

Useful commands:

| Command | Description |
| --- | --- |
| `npm run dev` | development server |
| `npm run build` / `npm start` | production build and server |
| `npm run build:static` | static export that runs in the browser (into `out/`) |
| `npm test` | unit tests (Vitest) |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint |
| `npm run db:migrate` | apply/create migrations during development (and embed them for automatic setup) |
| `npm run db:seed` | load the demo catalogue (85 products) and 3 example houses |
| `npm run db:reset` | recreate the database from scratch (and re-run the seed) |

## Deploying online (Vercel + Turso)

The full version (projects stored on the server, share links, products from
links) runs on [Vercel](https://vercel.com) with a [Turso](https://turso.tech)
database, which is SQLite in the cloud: same schema and migrations as the local
database. Both have free plans. Visitors only need a browser.

1. On Vercel, sign in with GitHub and choose **Add New → Project**, then import
   this repository. Next.js is detected automatically and the production branch
   is the repository's default branch. Alternatively, without connecting the
   repository to Vercel, the workflow
   [`.github/workflows/vercel.yml`](.github/workflows/vercel.yml) deploys an
   existing Vercel project on every push to the default branch: set the
   project and team IDs in the workflow and add a Vercel token as the
   `VERCEL_TOKEN` repository secret (this is how https://solros-web.vercel.app
   is published).
2. In the project, open **Storage** (or the Marketplace), add **Turso**, create
   a database in a European region (for example Frankfurt) and connect it to the
   project: Vercel adds `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` to the
   environment variables. Alternatively, create the database on turso.tech and
   add the two variables by hand.

   **Turn off database branching for Production.** The Turso integration can
   create a copy (branch) of the database for every deployment. On Production
   this means each new deployment starts from an empty copy and the data saved
   before (projects, the store catalogue) stays behind in the old branch. In
   **Storage → the Turso database → Projects**, edit the connection to the
   project and keep branching, if at all, for Preview only.
3. Deploy (or redeploy, if the first deployment ran before the database was
   connected).

On the first request the app creates the tables and loads the demo catalogue
and example houses by itself (`src/lib/server/dbSetup.ts`), so no command needs
to be run on the database. Every push to the default branch is deployed again.
Without a Turso database the app answers with an explicit configuration error,
because Vercel's file system does not persist data.

### Private access

To keep the site for yourself, add a `SITE_PASSWORD` environment variable to the
Vercel project (Settings → Environment Variables, Production; at least 12
characters) and redeploy. From then on:

- pages redirect to `/accesso`, where the password is asked once; the browser
  then keeps an HttpOnly cookie for a year, and API requests without it get 401;
- the cookie is an HMAC of the password, so changing the password signs
  everyone out;
- wrong attempts are limited to 10 every 15 minutes per address;
- read-only share links (`/share/…`) keep working for whoever you send them to,
  since their token cannot be guessed;
- *Esci* (Sign out) on the home page removes the cookie.

The check runs in `src/proxy.ts` (Next.js Proxy). Without `SITE_PASSWORD`, for
example locally, the site stays open. The static build has no server and
therefore no password.

Notes:

- `vercel.json` places the functions in Frankfurt (`fra1`), close to a European
  database.
- Rate limits (product link reading, Claude analyses) are kept in memory, so on
  Vercel they apply to each running instance.
- `CRON_SECRET` (at least 16 random characters) enables the daily update of
  the store catalogue (see
  [Store catalogue](#store-catalogue-ikea-and-jysk-updated-every-day)).
- Maintenance routes (`/api/admin/projects`: list projects, delete one with
  `?id=`) exist only while the `ADMIN_TOKEN` environment variable (at least 32
  characters) is set, and require `Authorization: Bearer <ADMIN_TOKEN>`;
  otherwise they answer 404.
- To enable floor plan recognition with Claude online, add
  `FLOORPLAN_ANALYZER=claude` and `ANTHROPIC_API_KEY` to the Vercel environment
  variables (see [Floor plan import](#floor-plan-import)).

## Static version (browser only)

`npm run build:static` produces a build of the app that runs entirely in the
browser and can be served by any static host. It is published as a public demo
on GitHub Pages; visitors' projects stay in their own browsers, so none of your
data is exposed:

- projects and the products you add are stored in the browser (IndexedDB) and
  stay on that device: use *Esporta progetto (JSON)* (Export project) to keep
  or move them;
- available: room editor, house composition, floors, demo catalogue, CSV/JSON
  catalogue import, manual products, floor plan import with local
  recognition, kitchen configurator, 3D view, quote with PDF/CSV export,
  JSON export/import;
- not available, because they need the server: product from link, floor plan
  recognition with Claude, read-only share links. The app hides them and the
  home page explains why.

How it works:

- `NEXT_PUBLIC_STATIC_EXPORT=1` (set by `npm run build:static`) switches Next.js
  to `output: "export"`. API routes (`route.ts`) and pages with dynamic
  parameters (`page.server.tsx`) are excluded through `pageExtensions`; the
  editor becomes `/editor/?id=…` (`page.static.tsx`).
- Components access data only through `api` (`src/lib/client/api.ts`), which
  uses the server API or, in the static build, the browser store
  (`src/lib/client/localBackend.ts`) with the same operations.
- `NEXT_PUBLIC_BASE_PATH` sets the site prefix (for example `/solros-web`).

To try it locally:

```bash
NEXT_PUBLIC_BASE_PATH=/solros-web npm run build:static
# serve out/ under /solros-web/ with any static file server
```

Deployment: the workflow [`.github/workflows/pages.yml`](.github/workflows/pages.yml)
runs the tests, builds the static version and publishes it on every push to the
default branch. Enable it once in the repository settings: **Settings → Pages →
Build and deployment → Source: GitHub Actions**.

## Architecture

- **Next.js (App Router) + TypeScript + Tailwind**: user interface and API.
- **react-konva**: 2D floor plan editor.
- **three.js + react-three-fiber (drei)**: 3D view.
- **Zustand + Immer**: editor state with undo/redo and autosave.
- **Prisma + SQLite (libSQL)**: projects, product catalogue, simple users; a
  local file in development, Turso online. Missing migrations and demo data are
  applied automatically on startup.
- **pdf.js, PapaParse, jsPDF**: PDF floor plan import, CSV import, PDF export.
- **Vitest**: tests for geometry, pricing, catalogue, kitchen and data logic.

### Data model

`House → Floor → Room → { walls, openings, items }`, all in centimetres
(`src/domain/schema.ts`, zod schemas from which the types are derived).

- Each room is a **polygon in local coordinates** representing the inner face
  of its walls, plus a position and rotation on the floor. Entered dimensions
  are therefore net, and the area is the usable floor area. Any shape is
  supported, including L-shapes.
- `walls[i]` is the wall on edge `polygon[i] → polygon[i+1]` and defines its
  thickness; walls grow outwards from the polygon.
- Openings (doors, windows, passages) belong to a wall, with distance from the
  corner, width, height and sill height.

### Wall geometry

`src/lib/geometry/walls.ts` computes the actual walls of a floor from its
rooms: mitred joints, and **shared walls** detected geometrically (two facing
edges at a distance equal to the wall thickness). A shared segment is
generated once and cut by the openings of both rooms, so moving rooms creates
or breaks the shared wall automatically.

### Project structure

```
src/domain/          data model, factories, room operations, templates, example houses
src/lib/geometry/    vectors, polygons, snapping, derived walls, collisions, placement
src/lib/pricing/     quote, CSV and PDF export
src/lib/client/      data access from the browser: server API or browser store (static build)
src/lib/server/      database, users, safe web page fetching (server only)
src/catalog/         CatalogProvider, filters, demo catalogue, CSV/JSON import, link metadata
src/floorplan/       floor plan loading and analysis, Claude analyzer
src/kitchen/         kitchen configurator (module layout, finishes)
src/store/           editor state, actions, autosave
src/components/      2D editor (Konva), 3D view, panels, dialogs, home page
src/app/api/         REST API (projects, sharing, users, catalogue, floor plans)
prisma/              schema, migrations and seed
tests/               Vitest tests
```

### Tests

`npm test` runs the Vitest suites in `tests/`: geometry (polygons, snapping,
shared walls and room joining, collisions, furniture placement), room and
floor operations, pricing and CSV export, catalogue filters and import,
product metadata from links, protections of web page fetching (SSRF,
robots.txt, request size), floor plan recognition on synthetic images,
kitchen composition, rate limiting, editor undo/redo and the browser store of
the static build.

## Usage

- **Home**: create a room from its dimensions, start from a template or reopen
  a project.
- **Drawing**: *Disegna* (Draw) tool, key D; click to add vertices with snapping
  to the grid, to 90° and to alignments; type a length and press Enter for an
  exact side; close by clicking the first point or double-clicking.
- **Room mode** (*Stanza*): drag vertices and edges, double-click a wall to add
  a vertex, edit every side from the properties panel.
- **Openings**: drag a door, window or passage (*Porta*, *Finestra*,
  *Passaggio*) from the toolbar onto a wall, then adjust width, height, sill
  height, hinge side and swing direction.
- Shortcuts: `Delete`, `Ctrl+Z`, `Ctrl+Shift+Z`, `R`, `Ctrl+D`, arrow keys, `Esc`
  (full list from the "?" button in the editor).
- **Tablets**: tap to select and drag, two fingers to zoom and pan the plan.
  Below 1024 px width, the catalogue and rooms panel opens from the button at
  the top right.

## House composition

- In **house mode** (*Casa*) every room is a draggable block. When it gets
  close to another room, facing edges snap at the existing wall thickness
  (highlighted in blue) and become a **shared wall**; façade walls align on the
  same line (orange) and nearby corners meet. Hold Alt to disable snapping.
- **Unisci** (Join; toolbar or room panel) moves the selected room against the
  chosen or nearest room, at any distance.
- Doors and passages can be placed on a shared wall like on any other wall;
  *Apri tutto il muro condiviso* (Open the whole shared wall) creates a passage
  along the entire segment.
- Duplicate (`Ctrl+D`), rotate (`R`), rename, colour and set a type (kitchen,
  bedroom, bathroom…) for rooms; library of ready-made templates.
- **Floors**: from the selector at the top, add floors above or below, with
  the level computed from ceiling height and slab thickness; the floor below
  stays visible in transparency and its rooms can be copied. Stairs from the
  catalogue link to another floor, where their footprint is shown.

## Kitchen configurator

From a room panel (*Configura cucina*) or the **Cucina** (Kitchen) toolbar
button (`src/kitchen/`):

- **linear** layout on one wall or **corner** layout on two adjacent walls,
  with lengths editable to the centimetre;
- **automatic filling** with standard base units (30/40/60/80 cm, drawer
  units) and a filler for the remainder; units can then be resized by hand and
  the filler adapts;
- wall units aligned with the base units, dish rack above the sink, no wall
  units in front of windows;
- appliances attached to compatible units: oven under the worktop or in a
  tall unit, induction or gas hob, integrated dishwasher, built-in fridge in a
  tall unit or freestanding, under-cabinet or wall-mounted hood;
- choice of fronts, handles and worktop, with a front elevation and a
  **component list** with the total price.

When applied, the units become room items (visible in plan and in 3D) and go
into the quote together with the finishes (front surcharge, handles, plinth).

## Quote, sharing and export

- **Quote** (total at the top right): aggregated lines with quantities,
  grouped by room or by retailer, or as a shopping list; prices always shown
  with their update date and a warning that they may have changed.
- **Esporta PDF** and **Esporta CSV** (name, code, retailer, link, quantity,
  unit price and total, rooms); the CSV uses `;` and a decimal comma so it opens
  correctly in Excel with Italian settings.
- **Apri i link dei prodotti** (Open product links): opens the product pages in
  new tabs (the browser may ask you to allow pop-ups).
- **Progetto** (Project) menu: read-only share link (revocable), project export
  as JSON, duplication. A previously exported JSON project can be imported from
  the home page.

## 3D view

The **3D** button at the top switches to the 3D view (same project, no
conversion). Walls are extruded with door and window openings, glass and door
leaves, floors and walls use procedural materials and textures, and furniture
uses its glTF model when available or a parametric model generated from its
shape.

- **Orbit** (*Orbita*): drag to rotate, right button to pan, wheel to zoom.
- **Walk** (*Camminata*): drag to look around, W A S D or arrow keys to move
  (on-screen buttons on tablets); walls block you, doors do not.
- **Top** (*Dall'alto*): orthographic plan view.
- Ceilings and floors above the active one can be hidden.
- Click an object to select it and edit it from the properties panel.

## Floor plan import

From the home page (*Carica una planimetria*, Upload a floor plan) or the
**Planimetria** toolbar button, load a PNG, JPG or PDF file (for a PDF, the
first page is rasterized with pdf.js, whose worker is served locally from
`public/`).

1. **Background**: the image becomes the semi-transparent background of the
   floor (opacity, visibility and position adjustable from the floor panel).
2. **Calibration**: click two points whose distance you know (for example a
   dimensioned wall) and enter the real length in cm.
3. Two modes:
   - **Assisted tracing**: the *Disegna* tool snaps points to the wall faces
     detected in the image;
   - **Automatic recognition**: rooms, doors and windows are generated as a
     draft and stay editable like hand-drawn ones.

Recognition goes through the `FloorplanAnalyzer` abstraction
(`src/floorplan/types.ts`), with two implementations:

| Analyzer | Runs | How it works |
| --- | --- | --- |
| local (default) | in the browser, plain TypeScript | Otsu threshold, wall thickness estimation, morphological opening and closing, closed regions = rooms, gaps = doors, thin lines inside walls = windows |
| Claude vision | server, `POST /api/floorplan/analyze` | the image is sent to the Anthropic API, which returns rooms and openings as validated JSON |

To enable the remote analyzer, in `.env`:

```bash
FLOORPLAN_ANALYZER="claude"
ANTHROPIC_API_KEY="..."
# optional, defaults to claude-opus-5-5
ANTHROPIC_MODEL="claude-opus-5-5"
# optional: analyses per hour per user and in total (defaults 10 and 60)
FLOORPLAN_ANALYZER_USER_LIMIT=10
FLOORPLAN_ANALYZER_HOURLY_LIMIT=60
```

Each analysis is a paid API call: the server runs one at a time per user and
applies the hourly limits above (in-memory counters, reset on restart). Past
the limit, users can still use local recognition.

The request uses structured outputs, checks the `stop_reason` and, if the
model's safety filters refuse the image, is automatically retried on the
recommended fallback model (`fallbacks: "default"`). Without this
configuration only the local analyzer is available.

## Shop window and cart

- **Vetrina** (`/catalogo`, Shop window): the whole catalogue as a grid with
  large photos (or the plan symbol when a product has no photo), text search,
  filters by store, category and maximum price, sorting and *Carica altri*
  (Load more). Each card has *Al carrello* (Add to cart) and, when the product
  has a link, *Negozio* (Store).
- **Carrello** (`/carrello`, Cart): products grouped by store with photo,
  article code, quantity and totals. For each store:
  - Amazon products (ASIN in the link) and Shopify stores (variant in the feed
    id, `shopify_IT_<product>_<variant>`) get a button that fills the store's
    own cart in one click; an affiliate `tag` in Amazon links is kept;
  - other stores (IKEA included) get a button that opens the product pages,
    plus *Copia elenco* (Copy list) with article codes and quantities;
  - all the furniture of a project can be added at once, from the cart page or
    from the quote dialog in the editor.
- The cart is stored in the browser (`localStorage`), so it also works in the
  static build; the logic lives in `src/lib/cart/cart.ts`.

## Product catalogue

The catalogue is built around the `CatalogProvider` interface
(`src/catalog/types.ts`): each source returns its own products, while text
search, filters (retailer, category, price, dimensions, colour) and facets are
applied uniformly by `src/catalog/filter.ts`.

| Provider | Source |
| --- | --- |
| `StoreProvider` | real IKEA products (photo, price, dimensions), re-read every day by the server (see below) |
| `DemoProvider` | ~80 generic products with indicative prices, marked "dati demo" (demo data) |
| `FileImportProvider` | catalogues and feeds imported from CSV/JSON |
| `ProductLinkProvider` | products pre-filled from the link of a product page |
| `ManualProvider` | custom products entered by hand |

Prices are always shown with their update date and a warning that they may
have changed. The retailers in the demo catalogue are fictitious.

### Store catalogue (IKEA and JYSK), updated every day

The *Negozi* (Stores) source holds real products from two stores:

- **IKEA Italy**: about 30 per furniture type (sofas, armchairs, TV units,
  bookcases, storage cabinets, coffee tables, rugs, plants, beds, wardrobes,
  chests of drawers, bedside tables, tables, chairs, stools, sideboards, desks,
  bathroom cabinets, shoe cabinets, mirrors, floor, pendant, wall and table
  lamps, appliances), about 700 pages;
- **JYSK Italy**: about 15 per type (sofas, armchairs, coffee tables,
  bookcases, rugs, plants, beds, wardrobes, chests of drawers, bedside tables,
  tables, chairs, sideboards, desks, mirrors, lamps), about 225 pages.

How it works:

- The repository only contains the lists of product page addresses,
  `src/catalog/store/<store>-links.json`, chosen from each store's public
  sitemaps by `node scripts/store-links.mjs <ikea|jysk> [products-per-type]`.
  A list is kept stable: pages already chosen stay while they are still valid,
  and new ones only replace those that disappeared; spare parts, accessories,
  textiles and sets of several pieces (a table with chairs) are left out.
  Names, prices, dimensions and photos are read from the pages and stored in
  the database.
- `src/lib/server/storeSync.ts` re-reads the pages one at a time: robots.txt is
  checked first (if it cannot be read, nothing is fetched from that site), each
  site gets at least 2 seconds between requests or the longer `Crawl-delay` it
  asks for (sites asking for more than 30 seconds are skipped), and the run
  stops early if a site answers 429 or 503. Each page is read again after
  3 days (14 days when the page lacks data, 30 when the product was
  withdrawn). A product whose page disappears or now redirects to a category
  is removed from the catalogue.
- Data come from the page's structured data (JSON-LD) and, when dimensions are
  missing there, from the page's measurement tables: IKEA's *Misure* section
  and JYSK's specification table (*Dimensioni da montato*; package dimensions
  are ignored).
- On Vercel, `vercel.json` schedules `/api/cron/store-sync` three times a day; each
  run reads up to 100 pages within the 5-minute function limit. The route is
  closed unless the `CRON_SECRET` environment variable is set: Vercel then
  sends it as `Authorization: Bearer <CRON_SECRET>`. With `?stato=1` the route
  only returns a summary (pages by status, products, last read, and the pages
  that could not be read with the reason); with `?riprova=1` it also re-reads
  at once the pages that lacked data, useful after improving the reader.
- The static build has no server, so it has no store catalogue.

Other Italian stores were checked (November 2026) and left out: Leroy Merlin
answers 403 to automated requests, Maisons du Monde blocks its robots.txt,
Kave Home answers 429 and Mondo Convenienza does not answer, Westwing's
robots.txt disallows product pages, Conforama, Emmezeta and Calligaris do not
list products in their sitemaps, and Poltronesofà publishes no prices in its
pages. For stores like these, an affiliate feed (see
[Feeds that update themselves](#feeds-that-update-themselves)) is the way in.
IKEA's 3D models are served only to IKEA's own site (requests from other
origins get 403), so they are not used.

The **Configuratori IKEA** page (`/configuratori`) links to IKEA's own
planners (kitchens, PAX and PLATSA wardrobes, BESTÅ, sofas, bathroom, office,
and more), grouped by room; the kitchen configurator links to the IKEA kitchen
planner as well. The list is in `src/catalog/ikeaPlanners.ts`.

### Importing a catalogue from CSV, JSON or XML

From the catalogue panel: **+ Aggiungi → Da file CSV, JSON o XML** (Add → From
CSV, JSON or XML file).

1. Choose the file: CSV with a header row (`,` or `;` separator), JSON (a list
   of products, also inside `products`/`items`; nested fields such as
   `offers.price` become columns) or XML (Google Merchant RSS/Atom feeds with
   `g:` fields, as provided by retailers and affiliate networks).
2. Columns are recognised by name (Italian or English: *nome/name*,
   *prezzo/price*, *larghezza/width*, *sku/codice*…) and can be corrected.
   Instead of three dimension columns, a single *dimensioni* column such as
   `200x90x85 cm` is enough.
3. Set the unit of measure (cm, mm, m) and the default retailer, then check the
   preview: discarded rows are listed with the reason.
4. *Importa* (Import): products go into your personal catalogue, grouped by
   batch (re-importing the same file updates the products; a batch can be
   deleted in one go).

[`docs/esempio-catalogo.csv`](docs/esempio-catalogo.csv) and
[`docs/esempio-feed.xml`](docs/esempio-feed.xml) are ready-made examples. Prices
and numbers accept the Italian format (`1.149,00`). For feeds, the standard
Google fields are recognised automatically: `title`, `price` and `sale_price`
(the lower one is used), currency written in the price (`899.00 EUR`), `link`,
`image_link`, `brand`, `id`, `product_type` (a `Soggiorno > Divani` hierarchy
becomes category and subcategory), `product_width`/`product_length`/
`product_height` with their unit (`800 mm`), or `size`; when dimensions are
missing they are read from the title or description.

### Feeds that update themselves

In the same dialog, instead of a file you can paste the **address of a feed**
(CSV, JSON or XML, also gzip-compressed, up to 20 MB and 5,000 products): the
server downloads it with the same protections used for product links, you check
the column mapping on a preview of the first 200 rows, and *Salva il feed e
importa* (Save the feed and import) imports it. From then on:

- when the catalogue is opened and the feed is more than a day old, the server
  downloads it again after answering the request (Next.js `after()`), so prices
  stay current without slowing the page down; each feed is claimed with a
  conditional update, so several server instances never download it twice;
- products that disappeared from the feed are removed, and other users'
  products are never touched;
- the list of imported catalogues shows when each feed was last updated and its
  outcome, with an *Aggiorna ora* (Update now) button; deleting the catalogue
  also deletes the feed.

Use only feeds provided by the retailer or by your affiliate programme. Saved
feeds need the server, so they are not available in the static version.
[`public/esempio-feed.xml`](public/esempio-feed.xml) is served by the app at
`/esempio-feed.xml` and can be used to try the feature.

### Product from link and manual product

**+ Aggiungi → Da link** (From link): paste the address of a product page (any
retailer) and the app reads, with a single request and only when you ask, the
page's public metadata (schema.org JSON-LD, Open Graph) to pre-fill name,
price, image and dimensions, which you confirm or correct before saving. No
bulk scraping: the site's `robots.txt` is respected, there is a minimum
interval between requests to the same domain, and the server refuses private
or local addresses (SSRF protection), including IPv6 forms and DNS answers
that change after the first check: the address is verified when the
connection is opened. If a site does not allow it, enter the product by hand
(**Inserimento manuale**, Manual entry).

Product links (page, image, 3D model) only accept `http`/`https` addresses;
addresses typed without a scheme (`www.site.com/...`) are completed. In the CSV
export, text that would start a formula (`=`, `+`, `-`, `@`) is prefixed with an
apostrophe so that Excel does not execute it.

### Adding a new CatalogProvider

1. Create a file in `src/catalog/providers/`, for example `myFeed.ts`:

   ```ts
   import "server-only";
   import type { CatalogProvider } from "../types";

   export const MyFeedProvider: CatalogProvider = {
     id: "import",               // one of the ProductSource values
     label: "My Shop feed",
     description: "Products from My Shop's affiliate feed",
     async list(ctx) {
       // return Product[] (see ProductSchema in src/domain/schema.ts)
       return [];
     },
   };
   ```

2. Register it in `CATALOG_PROVIDERS` in `src/catalog/service.ts`.

Every product has: id, retailer, name, category and subcategory,
width/depth/height in cm, price and currency, colour, image, URL, mounting
type (floor, wall, ceiling), clearance (front and side space) and an optional
glTF model. Without glTF, the 3D view uses a parametric shape (`shape`).

## Placing furniture

- Drag a product from the catalogue onto the plan, or use **+** to place it in
  a free spot of the selected room.
- While dragging, the object snaps to walls (corners included), to the centre
  of the room and to the edges of other objects; hold Alt to move it freely.
- The handle in front of the object rotates it in 15° steps; `R` rotates by 90°.
- Collisions, objects outside the room, blocked doors and occupied opening
  clearances are highlighted in red and explained in the properties panel.
- Wall-mounted objects (wall units, mirrors, wall lights) have an adjustable
  height from the floor and do not collide with floor furniture below them.
