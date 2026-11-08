/** Accesso minimo a IndexedDB per l'archivio nel browser della versione statica. */

const DB_NAME = "configuratore-casa";
const DB_VERSION = 1;

export type StoreName = "projects" | "products";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      if (typeof indexedDB === "undefined") {
        reject(new Error("IndexedDB non disponibile"));
        return;
      }
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("projects")) db.createObjectStore("projects", { keyPath: "id" });
        if (!db.objectStoreNames.contains("products")) db.createObjectStore("products", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error ?? new Error("Apertura dell'archivio non riuscita"));
      req.onblocked = () => reject(new Error("Archivio del browser bloccato da un'altra scheda"));
    });
    dbPromise.catch(() => {
      dbPromise = null;
    });
  }
  return dbPromise;
}

/** Esegue `fn` in una transazione e risolve al suo completamento con il risultato dell'ultima richiesta. */
async function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T> | void): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode);
    let result: T | undefined;
    const req = fn(tx.objectStore(store));
    if (req) req.onsuccess = () => (result = req.result);
    tx.oncomplete = () => resolve(result as T);
    tx.onerror = () => reject(tx.error ?? new Error("Operazione sull'archivio non riuscita"));
    tx.onabort = () => reject(tx.error ?? new Error("Operazione sull'archivio annullata"));
  });
}

export const idb = {
  all: <T>(store: StoreName) => run<T[]>(store, "readonly", (s) => s.getAll() as IDBRequest<T[]>),
  get: <T>(store: StoreName, id: string) => run<T | undefined>(store, "readonly", (s) => s.get(id) as IDBRequest<T | undefined>),
  putMany: (store: StoreName, values: unknown[]) =>
    run<void>(store, "readwrite", (s) => {
      for (const v of values) s.put(v);
    }),
  deleteMany: (store: StoreName, ids: string[]) =>
    run<void>(store, "readwrite", (s) => {
      for (const id of ids) s.delete(id);
    }),
};
