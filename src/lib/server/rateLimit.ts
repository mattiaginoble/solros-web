/**
 * Limite di utilizzi in una finestra scorrevole, tenuto in memoria: vale per
 * un singolo processo server, adatto a un'installazione con un solo nodo.
 */
export class SlidingWindowLimiter {
  private hits = new Map<string, number[]>();
  private lastSweep = -Infinity;

  constructor(
    readonly limit: number,
    readonly windowMs: number,
  ) {
    if (!(limit >= 1)) throw new Error("Il limite deve essere almeno 1");
  }

  /** Millisecondi da attendere prima del prossimo utilizzo consentito (0 = subito). */
  wait(key: string, now = Date.now()): number {
    const recent = this.recent(key, now);
    return recent.length < this.limit ? 0 : recent[recent.length - this.limit] + this.windowMs - now;
  }

  /** Registra un utilizzo. */
  record(key: string, now = Date.now()) {
    if (now - this.lastSweep >= this.windowMs) {
      for (const k of [...this.hits.keys()]) this.recent(k, now);
      this.lastSweep = now;
    }
    this.hits.set(key, [...this.recent(key, now), now]);
  }

  /** Numero di chiavi con utilizzi ancora nella finestra. */
  get size() {
    return this.hits.size;
  }

  private recent(key: string, now: number): number[] {
    const list = (this.hits.get(key) ?? []).filter((t) => now - t < this.windowMs);
    if (list.length) this.hits.set(key, list);
    else this.hits.delete(key);
    return list;
  }
}

/** Intero positivo da una variabile d'ambiente, altrimenti il valore predefinito. */
export function envLimit(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}
