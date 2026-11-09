/**
 * Righe da un feed prodotti XML: Google Merchant (RSS o Atom con campi g:),
 * feed delle reti di affiliazione e simili. Parser leggero senza DOM, usato
 * sia nel browser (import manuale) sia sul server (aggiornamento dei feed).
 */

const ITEM_TAGS = ["item", "entry", "product", "offer", "prodotto"];

function decode(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&amp;/g, "&");
}

const localName = (tag: string) => tag.slice(tag.indexOf(":") + 1).toLowerCase();

/** Campi di un elemento prodotto; i figli annidati diventano chiavi "padre.figlio". */
function fields(inner: string, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  const re = /<([\w:.-]+)(\s[^>]*?)?(?:\/>|>([\s\S]*?)<\/\1\s*>)/g;
  for (const m of inner.matchAll(re)) {
    const key = prefix + localName(m[1]);
    const content = m[3];
    if (content === undefined) {
      // Elemento vuoto: in Atom il link è nell'attributo href.
      const href = /\bhref=["']([^"']+)["']/.exec(m[2] ?? "")?.[1];
      if (href && out[key] === undefined) out[key] = decode(href);
      continue;
    }
    const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(content);
    if (!cdata && /<[\w]/.test(content)) {
      fields(content, `${key}.`, out);
      continue;
    }
    // Il primo valore vince (es. più additional_image_link).
    if (out[key] === undefined) out[key] = (cdata ? cdata[1] : decode(content)).trim();
  }
  return out;
}

export function rowsFromXml(xml: string): Record<string, unknown>[] {
  const body = xml.replace(/<!--[\s\S]*?-->/g, "");
  const tag = ITEM_TAGS.find((t) => new RegExp(`<(?:[\\w-]+:)?${t}[\\s>]`, "i").test(body));
  if (!tag) throw new Error("Nel file XML non ci sono prodotti (elementi item, entry o product)");
  const re = new RegExp(`<((?:[\\w-]+:)?${tag})(?:\\s[^>]*)?>([\\s\\S]*?)</\\1\\s*>`, "gi");
  const rows = [...body.matchAll(re)].map((m) => fields(m[2])).filter((r) => Object.keys(r).length > 0);
  if (!rows.length) throw new Error("Nel file XML non ci sono prodotti leggibili");
  return rows;
}
