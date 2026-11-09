import Link from "next/link";
import { CartLink } from "@/components/cart/CartLink";
import { IKEA_PLANNER_GROUPS } from "@/catalog/ikeaPlanners";

/** Elenco dei configuratori ufficiali di IKEA, raggruppati per stanza. */
export function IkeaPlannersPage() {
  return (
    <div className="min-h-dvh bg-paper">
      <header className="sticky top-0 z-10 border-b border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-5 py-4">
          <Link href="/" className="whitespace-nowrap text-[15px] font-semibold hover:text-prussian">
            ← <span className="hidden sm:inline">Configuratore </span>Casa
          </Link>
          <nav aria-label="Sezioni" className="flex items-center gap-4 whitespace-nowrap sm:gap-5">
            <Link href="/catalogo" className="text-sm font-medium hover:text-prussian">
              Vetrina
            </Link>
            <CartLink />
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-5 pb-20 pt-6">
        <h1 className="text-[clamp(1.8rem,4vw,2.6rem)] font-semibold tracking-[-0.02em]">Configuratori IKEA</h1>
        <p className="mt-1 max-w-2xl text-sm text-graphite-soft">
          Gli strumenti di progettazione ufficiali di IKEA Italia, per comporre cucine, armadi, divani e librerie con tutte le varianti. Si
          aprono sul sito IKEA in una nuova scheda: il progetto si salva lì. Prendi le misure della composizione e riportala qui nella
          pianta.
        </p>

        <div className="mt-6 flex flex-col gap-8">
          {IKEA_PLANNER_GROUPS.map((group) => (
            <section key={group.id} aria-labelledby={`gruppo-${group.id}`}>
              <h2 id={`gruppo-${group.id}`} className="text-lg font-semibold">
                {group.title}
              </h2>
              <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {group.planners.map((p) => (
                  <li key={p.id}>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="group flex h-full flex-col gap-1 rounded-[6px] border border-line-strong bg-panel p-4 hover:border-prussian"
                    >
                      <span className="flex items-baseline justify-between gap-2 text-[15px] font-medium group-hover:text-prussian">
                        {p.name}
                        <span aria-hidden className="text-muted group-hover:text-prussian">
                          ↗
                        </span>
                      </span>
                      <span className="text-sm leading-snug text-graphite-soft">{p.description}</span>
                      <span className="sr-only">(si apre sul sito IKEA in una nuova scheda)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <p className="mt-10 text-xs text-muted">
          Collegamenti al sito ikea.com/it: Configuratore Casa non è collegato a IKEA e non ne copia i progetti.
        </p>
      </main>
    </div>
  );
}
